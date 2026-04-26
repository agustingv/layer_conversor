<?php

namespace App\MessageHandler;

use App\Entity\Layer;
use App\Entity\LayerGroup;
use App\GeoConverter\GeoConverterService;
use App\Message\ConvertLayerFileMessage;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class ConvertLayerFileMessageHandler
{
    public function __construct(
        private readonly LayerRepository $layerRepository,
        private readonly EntityManagerInterface $em,
        private readonly GeoConverterService $geoConverter,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    public function __invoke(ConvertLayerFileMessage $message): void
    {
        ini_set('memory_limit', '2048M');

        $layer = $this->layerRepository->find($message->layerId);

        if (!$layer || !$layer->getFilePath()) {
            return;
        }

        $inputPath = $this->projectDir . '/var/private/layers/' . $layer->getFilePath();

        if (!file_exists($inputPath)) {
            $layer->setConversionStatus('error');
            $layer->setConversionError('Uploaded file not found on disk.');
            $this->em->flush();
            return;
        }

        if (!$this->geoConverter->supportsFile($inputPath)) {
            $layer->setConversionStatus('error');
            $layer->setConversionError('Unsupported file format: ' . pathinfo($inputPath, PATHINFO_EXTENSION));
            $this->em->flush();
            return;
        }

        $outputDir = $this->projectDir . '/public/geojson';
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        try {
            $detectedLayers = $this->geoConverter->detectLayers($inputPath);
            $ext = strtolower(pathinfo($inputPath, PATHINFO_EXTENSION));

            if (count($detectedLayers) > 1) {
                if ($ext === 'zip') {
                    $produced = $message->merge
                        ? $this->expandZipMerged($layer, $inputPath, $outputDir)
                        : $this->expandZip($layer, $inputPath, $outputDir);
                } else {
                    $produced = $message->merge
                        ? $this->expandLayersMerged($layer, $inputPath, $outputDir)
                        : $this->expandLayers($layer, $inputPath, $outputDir, $detectedLayers);
                }

                if (count($produced) > 1) {
                    $this->attachGroup($layer, $produced);
                }
            } else {
                $outputFile = $outputDir . '/' . $message->layerId . '.geojson';
                $this->geoConverter->convertToFile($inputPath, $outputFile);
                $layer->setGeoJsonPath('/geojson/' . $message->layerId . '.geojson');
                $layer->setConversionStatus('done');
                $layer->setMetadata($this->geoConverter->extractMetadata($inputPath));
            }
        } catch (\Throwable $e) {
            $layer->setConversionStatus('error');
            $layer->setConversionError($e->getMessage());
        }

        $this->em->flush();
    }

    /** Creates a LayerGroup named after the original layer and assigns all produced layers to it. */
    private function attachGroup(Layer $original, array $layers): void
    {
        $group = new LayerGroup();
        $group->setName($original->getName());
        $group->setProject($original->getProject());
        $this->em->persist($group);

        foreach ($layers as $layer) {
            $group->addLayer($layer);
        }
        // flushed by the caller (__invoke)
    }

    /** @param string[] $layerNames @return Layer[] */
    private function expandLayers(Layer $original, string $inputPath, string $outputDir, array $layerNames): array
    {
        $produced = [];

        foreach ($layerNames as $index => $layerName) {
            $target = $index === 0 ? $original : $this->newLayer($layerName, $original);

            $targetId = (string) $target->getId();
            $outputFile = $outputDir . '/' . $targetId . '.geojson';

            try {
                $this->geoConverter->convertNamedLayerToFile($inputPath, $outputFile, $layerName);
                $target->setGeoJsonPath('/geojson/' . $targetId . '.geojson');
                $target->setConversionStatus('done');
                $target->setMetadata($this->geoConverter->extractNamedLayerMetadata($inputPath, $layerName));
            } catch (\Throwable $e) {
                $target->setConversionStatus('error');
                $target->setConversionError($e->getMessage());
            }

            $produced[] = $target;
        }

        $this->em->flush();
        return $produced;
    }

    /** @return Layer[] */
    private function expandLayersMerged(Layer $original, string $inputPath, string $outputDir): array
    {
        $groups = $this->geoConverter->detectLayerGroups($inputPath);
        $produced = [];
        $index = 0;

        foreach ($groups as $geometryType => $names) {
            $target = $index === 0
                ? $original
                : $this->newLayer($original->getName() . ' – ' . $geometryType, $original);

            $targetId = (string) $target->getId();
            $outputFile = $outputDir . '/' . $targetId . '.geojson';

            try {
                if (count($names) === 1) {
                    $this->geoConverter->convertNamedLayerToFile($inputPath, $outputFile, $names[0]);
                } else {
                    $this->geoConverter->mergeNamedLayersToFile($inputPath, $outputFile, $names);
                }
                $target->setGeoJsonPath('/geojson/' . $targetId . '.geojson');
                $target->setConversionStatus('done');
                $target->setMetadata($this->geoConverter->extractNamedLayerMetadata($inputPath, $names[0]));
            } catch (\Throwable $e) {
                $target->setConversionStatus('error');
                $target->setConversionError($e->getMessage());
            }

            $produced[] = $target;
            $index++;
        }

        $this->em->flush();
        return $produced;
    }

    /** @return Layer[] */
    private function expandZipMerged(Layer $original, string $zipPath, string $outputDir): array
    {
        $tempDir = $this->geoConverter->extractZip($zipPath);

        try {
            $shpFiles = $this->geoConverter->findShapefiles($tempDir);

            $groups = [];
            foreach ($shpFiles as $shpPath) {
                $meta = $this->geoConverter->extractShpMetadata($shpPath);
                $type = $meta['geometryType'] ?? 'Unknown';
                $groups[$type][] = $shpPath;
            }

            $produced = [];
            $index = 0;

            foreach ($groups as $geometryType => $paths) {
                $target = $index === 0
                    ? $original
                    : $this->newLayer($original->getName() . ' – ' . $geometryType, $original);

                $targetId = (string) $target->getId();
                $outputFile = $outputDir . '/' . $targetId . '.geojson';

                try {
                    if (count($paths) === 1) {
                        $this->geoConverter->convertShpToFile($paths[0], $outputFile);
                    } else {
                        $this->geoConverter->mergeShpFilesToFile($paths, $outputFile);
                    }
                    $target->setGeoJsonPath('/geojson/' . $targetId . '.geojson');
                    $target->setConversionStatus('done');
                    $target->setMetadata($this->geoConverter->extractShpMetadata($paths[0]));
                } catch (\Throwable $e) {
                    $target->setConversionStatus('error');
                    $target->setConversionError($e->getMessage());
                }

                $produced[] = $target;
                $index++;
            }

            $this->em->flush();
            return $produced;
        } finally {
            $this->geoConverter->cleanupDir($tempDir);
        }
    }

    /** @return Layer[] */
    private function expandZip(Layer $original, string $zipPath, string $outputDir): array
    {
        $tempDir = $this->geoConverter->extractZip($zipPath);

        try {
            $shpFiles = $this->geoConverter->findShapefiles($tempDir);
            $produced = [];

            foreach ($shpFiles as $index => $shpPath) {
                $shpName = pathinfo($shpPath, PATHINFO_FILENAME);
                $target = $index === 0 ? $original : $this->newLayer($shpName, $original);

                $targetId = (string) $target->getId();
                $outputFile = $outputDir . '/' . $targetId . '.geojson';

                try {
                    $this->geoConverter->convertShpToFile($shpPath, $outputFile);
                    $target->setGeoJsonPath('/geojson/' . $targetId . '.geojson');
                    $target->setConversionStatus('done');
                    $target->setMetadata($this->geoConverter->extractShpMetadata($shpPath));
                } catch (\Throwable $e) {
                    $target->setConversionStatus('error');
                    $target->setConversionError($e->getMessage());
                }

                $produced[] = $target;
            }

            $this->em->flush();
            return $produced;
        } finally {
            $this->geoConverter->cleanupDir($tempDir);
        }
    }

    /** Persists and flushes a new child Layer, returning it with a UUID assigned. */
    private function newLayer(string $name, Layer $original): Layer
    {
        $layer = (new Layer())
            ->setName($name)
            ->setProject($original->getProject())
            ->setFilePath($original->getFilePath())
            ->setConversionStatus('pending');
        $this->em->persist($layer);
        $this->em->flush(); // flush immediately so UUID is generated
        return $layer;
    }
}
