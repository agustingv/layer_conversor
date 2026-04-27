<?php

namespace App\MessageHandler;

use App\Entity\Layer;
use App\GeoConverter\GeoJsonSplitterService;
use App\Message\SplitLayerMessage;
use App\Repository\LayerGroupRepository;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class SplitLayerMessageHandler
{
    public function __construct(
        private readonly LayerRepository $layerRepository,
        private readonly LayerGroupRepository $layerGroupRepository,
        private readonly EntityManagerInterface $em,
        private readonly GeoJsonSplitterService $splitter,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    public function __invoke(SplitLayerMessage $message): void
    {
        ini_set('memory_limit', '2048M');

        $layer = $this->layerRepository->find($message->layerId);
        $group = $this->layerGroupRepository->find($message->groupId);

        if (!$layer || !$group) {
            return;
        }

        $geoJsonPath = $this->projectDir . '/public' . $layer->getGeoJsonPath();

        if (!file_exists($geoJsonPath)) {
            $group->setSplitStatus('error');
            $this->em->flush();
            return;
        }

        try {
            $cells = $this->splitter->split($geoJsonPath);

            if (empty($cells)) {
                $group->setSplitStatus('error');
                $this->em->flush();
                return;
            }

            $outputDir = $this->projectDir . '/public/geojson';
            if (!is_dir($outputDir)) {
                mkdir($outputDir, 0755, true);
            }

            foreach ($cells as $index => $cell) {
                $filename = $message->layerId . '_cell_' . $index . '.geojson';
                $outputFile = $outputDir . '/' . $filename;

                file_put_contents($outputFile, json_encode([
                    'type' => 'FeatureCollection',
                    'features' => $cell['features'],
                ]));

                $child = (new Layer())
                    ->setName($layer->getName() . ' – ' . ($index + 1))
                    ->setProject($layer->getProject())
                    ->setGeoJsonPath('/geojson/' . $filename)
                    ->setConversionStatus('done')
                    ->setMetadata([
                        'featureCount' => count($cell['features']),
                        'geoJsonSize'  => $cell['size'],
                    ]);

                $this->em->persist($child);
                $group->addLayer($child);
            }

            $group->setSplitStatus('done');
        } catch (\Throwable $e) {
            $group->setSplitStatus('error');
        }

        $this->em->flush();
    }
}
