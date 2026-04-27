<?php

namespace App\GeoConverter;

class GeoConverterService
{
    private const SUPPORTED_EXTENSIONS = ['geojson', 'json', 'kml', 'kmz', 'gpx', 'gml', 'zip', 'gpkg', 'dgn', 'dxf'];

    public function convertToFile(string $inputPath, string $outputPath): void
    {
        $ext = strtolower(pathinfo($inputPath, PATHINFO_EXTENSION));

        if (in_array($ext, ['geojson', 'json'], true)) {
            if (!copy($inputPath, $outputPath)) {
                throw new \RuntimeException("Cannot copy file: $inputPath");
            }
            return;
        }

        if ($ext === 'zip') {
            $this->convertZipToFile($inputPath, $outputPath);
            return;
        }

        $vsiPath = $ext === 'kmz' ? '/vsizip/' . $inputPath : $inputPath;
        $this->runOgr2ogr($vsiPath, $outputPath);
    }

    private function convertZipToFile(string $zipPath, string $outputPath): void
    {
        $tempDir = sys_get_temp_dir() . '/' . uniqid('zip_', true);
        mkdir($tempDir, 0777, true);

        try {
            $zip = new \ZipArchive();
            if ($zip->open($zipPath) !== true) {
                throw new \RuntimeException('Cannot open ZIP file.');
            }
            $zip->extractTo($tempDir);
            $zip->close();

            $shpFiles = $this->findByExtension($tempDir, 'shp');

            if (empty($shpFiles)) {
                throw new \RuntimeException('No Shapefile (.shp) found inside the ZIP.');
            }

            if (count($shpFiles) === 1) {
                $this->runOgr2ogr($shpFiles[0], $outputPath);
                return;
            }

            $tempFiles = [];
            try {
                foreach ($shpFiles as $shp) {
                    $tmp = sys_get_temp_dir() . '/' . uniqid('shp_', true) . '.geojson';
                    $tempFiles[] = $tmp;
                    $this->runOgr2ogr($shp, $tmp);
                }
                $this->mergeGeoJsonFiles($tempFiles, $outputPath);
            } finally {
                foreach ($tempFiles as $f) {
                    if (file_exists($f)) unlink($f);
                }
            }
        } finally {
            $this->removeDir($tempDir);
        }
    }

    public function convertNamedLayerToFile(string $inputPath, string $outputPath, string $layerName): void
    {
        $this->runOgr2ogr($inputPath, $outputPath, $layerName);
    }

    private function runOgr2ogr(string $inputPath, string $outputPath, ?string $layerName = null): void
    {
        $command = sprintf(
            'ogr2ogr -f GeoJSON %s %s%s 2>&1',
            escapeshellarg($outputPath),
            escapeshellarg($inputPath),
            $layerName !== null ? ' ' . escapeshellarg($layerName) : '',
        );

        exec($command, $output, $exitCode);

        if ($exitCode !== 0 || !file_exists($outputPath)) {
            throw new \RuntimeException('GeoJSON conversion failed: ' . implode("\n", $output));
        }
    }

    private function findByExtension(string $dir, string $ext): array
    {
        $files = [];
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
        );
        foreach ($it as $file) {
            if ($file->isFile() && strtolower($file->getExtension()) === $ext) {
                $files[] = $file->getPathname();
            }
        }
        return $files;
    }

    private function removeDir(string $dir): void
    {
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($it as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($dir);
    }

    public function extractZip(string $zipPath): string
    {
        $tempDir = sys_get_temp_dir() . '/' . uniqid('zip_', true);
        mkdir($tempDir, 0777, true);

        $zip = new \ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException('Cannot open ZIP file.');
        }
        $zip->extractTo($tempDir);
        $zip->close();

        return $tempDir;
    }

    /** @return string[] absolute paths to .shp files */
    public function findShapefiles(string $dir): array
    {
        return $this->findByExtension($dir, 'shp');
    }

    public function convertShpToFile(string $shpPath, string $outputPath): void
    {
        $this->runOgr2ogr($shpPath, $outputPath);
    }

    public function cleanupDir(string $dir): void
    {
        $this->removeDir($dir);
    }

    /**
     * Returns the list of layer names inside a file.
     * For ZIP files, scans for .shp filenames without full extraction.
     * For other formats, delegates to ogrinfo.
     *
     * @return string[]
     */
    public function detectLayers(string $filePath): array
    {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if ($ext === 'zip') {
            $zip = new \ZipArchive();
            if ($zip->open($filePath) !== true) {
                return [];
            }
            $names = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = $zip->getNameIndex($i);
                if ($entry !== false && strtolower(pathinfo($entry, PATHINFO_EXTENSION)) === 'shp') {
                    $names[] = pathinfo($entry, PATHINFO_FILENAME);
                }
            }
            $zip->close();
            return $names;
        }

        // For other formats use ogrinfo -json to list layers
        $command = sprintf('ogrinfo -json %s 2>/dev/null', escapeshellarg($filePath));
        exec($command, $output, $exitCode);

        if ($exitCode !== 0) {
            return [];
        }

        $json = json_decode(implode('', $output), true);
        if (!is_array($json) || empty($json['layers'])) {
            return [];
        }

        return array_column($json['layers'], 'name');
    }

    /**
     * Groups layer names by geometry type.
     * For ZIP files extracts to a temp dir, reads each .shp, then cleans up.
     *
     * @return array<string, string[]> geometryType => layerNames[]
     */
    public function detectLayerGroups(string $filePath): array
    {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if ($ext === 'zip') {
            $tempDir = $this->extractZip($filePath);
            try {
                $groups = [];
                foreach ($this->findShapefiles($tempDir) as $shpPath) {
                    $meta = $this->runOgrinfoJson($shpPath);
                    $type = $meta['geometryType'] ?? 'Unknown';
                    $groups[$type][] = pathinfo($shpPath, PATHINFO_FILENAME);
                }
                return $groups;
            } finally {
                $this->cleanupDir($tempDir);
            }
        }

        $groups = [];
        foreach ($this->detectLayers($filePath) as $layerName) {
            $meta = $this->runOgrinfoJson($filePath, $layerName);
            $type = $meta['geometryType'] ?? 'Unknown';
            $groups[$type][] = $layerName;
        }
        return $groups;
    }

    /** Merges multiple named layers from one file into a single GeoJSON. */
    public function mergeNamedLayersToFile(string $inputPath, string $outputPath, array $layerNames): void
    {
        $tempFiles = [];
        try {
            foreach ($layerNames as $layerName) {
                $tmp = sys_get_temp_dir() . '/' . uniqid('layer_', true) . '.geojson';
                $tempFiles[] = $tmp;
                $this->runOgr2ogr($inputPath, $tmp, $layerName);
            }
            $this->mergeGeoJsonFiles($tempFiles, $outputPath);
        } finally {
            foreach ($tempFiles as $f) {
                if (file_exists($f)) unlink($f);
            }
        }
    }

    /** Merges multiple shapefiles into a single GeoJSON. */
    public function mergeShpFilesToFile(array $shpPaths, string $outputPath): void
    {
        $tempFiles = [];
        try {
            foreach ($shpPaths as $shpPath) {
                $tmp = sys_get_temp_dir() . '/' . uniqid('layer_', true) . '.geojson';
                $tempFiles[] = $tmp;
                $this->runOgr2ogr($shpPath, $tmp);
            }
            $this->mergeGeoJsonFiles($tempFiles, $outputPath);
        } finally {
            foreach ($tempFiles as $f) {
                if (file_exists($f)) unlink($f);
            }
        }
    }

    public function mergeGeoJsonFiles(array $inputFiles, string $outputPath): void
    {
        $features = [];
        foreach ($inputFiles as $file) {
            $content = file_get_contents($file);
            if ($content === false) continue;
            $json = json_decode($content, true);
            if (isset($json['features']) && is_array($json['features'])) {
                array_push($features, ...$json['features']);
            }
        }
        file_put_contents($outputPath, json_encode([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]));
    }

    public function supportsFile(string $filePath): bool
    {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        return in_array($ext, self::SUPPORTED_EXTENSIONS, true);
    }

    /**
     * Extracts geo metadata from a file.
     * For ZIP shapefiles, extracts the archive to read the first .shp.
     *
     * @return array<string, mixed>
     */
    public function extractMetadata(string $filePath): array
    {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if ($ext === 'zip') {
            $tempDir = $this->extractZip($filePath);
            try {
                $shpFiles = $this->findShapefiles($tempDir);
                if (empty($shpFiles)) {
                    return [];
                }
                return $this->runOgrinfoJson($shpFiles[0]);
            } finally {
                $this->cleanupDir($tempDir);
            }
        }

        return $this->runOgrinfoJson($filePath);
    }

    /** @return array<string, mixed> */
    public function extractShpMetadata(string $shpPath): array
    {
        return $this->runOgrinfoJson($shpPath);
    }

    /** @return array<string, mixed> */
    public function extractNamedLayerMetadata(string $filePath, string $layerName): array
    {
        return $this->runOgrinfoJson($filePath, $layerName);
    }

    /** @return array<string, mixed> */
    private function runOgrinfoJson(string $filePath, ?string $layerName = null): array
    {
        $command = sprintf(
            'ogrinfo -al -so -json %s%s 2>/dev/null',
            escapeshellarg($filePath),
            $layerName !== null ? ' ' . escapeshellarg($layerName) : '',
        );
        exec($command, $output, $exitCode);

        if ($exitCode !== 0) {
            return [];
        }

        $json = json_decode(implode('', $output), true);
        if (!is_array($json) || empty($json['layers'])) {
            return [];
        }

        $layer = $json['layers'][0];
        $meta = [];

        if (isset($layer['featureCount'])) {
            $meta['featureCount'] = (int) $layer['featureCount'];
        }

        $geoFields = $layer['geometryFields'] ?? [];
        if (!empty($geoFields)) {
            $meta['geometryType'] = $geoFields[0]['type'] ?? null;

            if (isset($geoFields[0]['extent'])) {
                [$xmin, $ymin, $xmax, $ymax] = $geoFields[0]['extent'];
                $meta['extent'] = [
                    'xmin' => round((float) $xmin, 6),
                    'ymin' => round((float) $ymin, 6),
                    'xmax' => round((float) $xmax, 6),
                    'ymax' => round((float) $ymax, 6),
                ];
            }

            $cs = $geoFields[0]['coordinateSystem'] ?? null;
            if ($cs !== null) {
                $id = $cs['projjson']['id'] ?? null;
                if (is_array($id) && isset($id['authority'], $id['code'])) {
                    $meta['crs'] = $id['authority'] . ':' . $id['code'];
                } elseif (isset($cs['wkt']) && preg_match('/ID\["EPSG",(\d+)\]/', $cs['wkt'], $m)) {
                    $meta['crs'] = 'EPSG:' . $m[1];
                }
            }
        }

        $meta['fields'] = array_map(
            fn(array $f) => ['name' => $f['name'], 'type' => $f['type']],
            $layer['fields'] ?? [],
        );

        return $meta;
    }
}
