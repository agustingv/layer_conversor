<?php

namespace App\GeoConverter;

class GeoJsonSplitterService
{
    private const MAX_BYTES = 5_000_000;

    /**
     * Splits a GeoJSON FeatureCollection into cells no larger than MAX_BYTES.
     * Uses quadtree subdivision; features are assigned by centroid (no clipping/duplication).
     *
     * @return array<int, array{features: array<mixed>, size: int}>
     */
    public function split(string $geoJsonPath): array
    {
        $content = file_get_contents($geoJsonPath);
        if ($content === false) {
            throw new \RuntimeException("Cannot read GeoJSON file: $geoJsonPath");
        }

        $geojson = json_decode($content, true);
        $features = $geojson['features'] ?? [];

        if (empty($features)) {
            return [];
        }

        $bbox = $this->bboxOfFeatures($features);
        $cells = $this->subdivide($features, $bbox);

        $result = [];
        foreach ($cells as $cell) {
            $json = json_encode(['type' => 'FeatureCollection', 'features' => $cell]);
            $result[] = ['features' => $cell, 'size' => strlen($json)];
        }

        return $result;
    }

    /**
     * @param array<mixed> $features
     * @param float[]      $bbox [minX, minY, maxX, maxY]
     * @return array<array<mixed>>
     */
    private function subdivide(array $features, array $bbox): array
    {
        if (empty($features)) {
            return [];
        }

        $estimated = strlen(json_encode(['type' => 'FeatureCollection', 'features' => $features]));
        if ($estimated <= self::MAX_BYTES || count($features) <= 1) {
            return [$features];
        }

        [$minX, $minY, $maxX, $maxY] = $bbox;
        $midX = ($minX + $maxX) / 2.0;
        $midY = ($minY + $maxY) / 2.0;

        /** @var array<array<mixed>> $quads  indexed: 0=SW 1=SE 2=NW 3=NE */
        $quads = [[], [], [], []];

        foreach ($features as $feature) {
            [$cx, $cy] = $this->centroid($feature['geometry'] ?? null);
            $xi = $cx < $midX ? 0 : 1;
            $yi = $cy < $midY ? 0 : 1;
            $quads[$yi * 2 + $xi][] = $feature;
        }

        $quadBboxes = [
            [$minX, $minY, $midX, $midY],
            [$midX, $minY, $maxX, $midY],
            [$minX, $midY, $midX, $maxY],
            [$midX, $midY, $maxX, $maxY],
        ];

        $cells = [];
        foreach ($quads as $i => $qFeatures) {
            if (empty($qFeatures)) {
                continue;
            }
            array_push($cells, ...$this->subdivide($qFeatures, $quadBboxes[$i]));
        }

        return $cells;
    }

    /** @return float[] [x, y] */
    private function centroid(?array $geometry): array
    {
        $coords = $this->flatCoords($geometry);
        if (empty($coords)) {
            return [0.0, 0.0];
        }
        $x = 0.0;
        $y = 0.0;
        foreach ($coords as [$cx, $cy]) {
            $x += $cx;
            $y += $cy;
        }
        $n = count($coords);
        return [$x / $n, $y / $n];
    }

    /** @param array<mixed> $features @return float[] [minX, minY, maxX, maxY] */
    private function bboxOfFeatures(array $features): array
    {
        $minX = PHP_FLOAT_MAX;
        $minY = PHP_FLOAT_MAX;
        $maxX = -PHP_FLOAT_MAX;
        $maxY = -PHP_FLOAT_MAX;

        foreach ($features as $feature) {
            foreach ($this->flatCoords($feature['geometry'] ?? null) as [$x, $y]) {
                if ($x < $minX) $minX = $x;
                if ($y < $minY) $minY = $y;
                if ($x > $maxX) $maxX = $x;
                if ($y > $maxY) $maxY = $y;
            }
        }

        return [$minX, $minY, $maxX, $maxY];
    }

    /** @return float[][] list of [x, y] pairs */
    private function flatCoords(?array $geometry): array
    {
        if ($geometry === null) {
            return [];
        }

        $type = $geometry['type'] ?? '';
        $raw  = $geometry['coordinates'] ?? null;

        if ($type === 'Point') {
            return (is_array($raw) && isset($raw[0], $raw[1]))
                ? [[(float) $raw[0], (float) $raw[1]]]
                : [];
        }

        if ($type === 'LineString' || $type === 'MultiPoint') {
            return $this->level1($raw);
        }

        if ($type === 'Polygon' || $type === 'MultiLineString') {
            return $this->level2($raw);
        }

        if ($type === 'MultiPolygon') {
            return $this->level3($raw);
        }

        if ($type === 'GeometryCollection') {
            $result = [];
            foreach ($geometry['geometries'] ?? [] as $g) {
                array_push($result, ...$this->flatCoords($g));
            }
            return $result;
        }

        return [];
    }

    /** @return float[][] */
    private function level1(?array $coords): array
    {
        if (!is_array($coords)) {
            return [];
        }
        $result = [];
        foreach ($coords as $c) {
            if (is_array($c) && isset($c[0], $c[1])) {
                $result[] = [(float) $c[0], (float) $c[1]];
            }
        }
        return $result;
    }

    /** @return float[][] */
    private function level2(?array $coords): array
    {
        if (!is_array($coords)) {
            return [];
        }
        $result = [];
        foreach ($coords as $ring) {
            array_push($result, ...$this->level1($ring));
        }
        return $result;
    }

    /** @return float[][] */
    private function level3(?array $coords): array
    {
        if (!is_array($coords)) {
            return [];
        }
        $result = [];
        foreach ($coords as $poly) {
            array_push($result, ...$this->level2($poly));
        }
        return $result;
    }
}
