<?php

namespace App\Controller;

use App\Entity\Layer;
use App\GeoConverter\GeoConverterService;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class MergeLayersController extends AbstractController
{
    public function __construct(
        private readonly LayerRepository $layerRepository,
        private readonly EntityManagerInterface $em,
        private readonly GeoConverterService $geoConverter,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    #[Route('/api/layers/merge', name: 'api_layers_merge', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?? [];
        $name = trim($body['name'] ?? '');
        $layerIris = $body['layers'] ?? [];

        if (!$name) {
            return $this->json(['error' => 'A name is required.'], 400);
        }

        if (count($layerIris) < 2) {
            return $this->json(['error' => 'Select at least 2 layers to merge.'], 400);
        }

        $layers = [];
        foreach ($layerIris as $iri) {
            $layer = $this->layerRepository->find(basename((string) $iri));
            if (!$layer) {
                return $this->json(['error' => "Layer not found: $iri"], 404);
            }
            if ($layer->getConversionStatus() !== 'done' || !$layer->getGeoJsonPath()) {
                return $this->json(['error' => "Layer \"{$layer->getName()}\" has no converted GeoJSON."], 422);
            }
            $layers[] = $layer;
        }

        $project = $layers[0]->getProject();

        $geojsonFiles = array_map(
            fn(Layer $l) => $this->projectDir . '/public' . $l->getGeoJsonPath(),
            $layers
        );

        $sourceIris = array_map(fn(Layer $l) => '/api/layers/' . $l->getId(), $layers);

        $newLayer = (new Layer())
            ->setName($name)
            ->setProject($project)
            ->setMerged(true)
            ->setSourceLayerIris($sourceIris)
            ->setConversionStatus('pending');

        $this->em->persist($newLayer);
        $this->em->flush();

        $newId = (string) $newLayer->getId();
        $outputDir = $this->projectDir . '/public/geojson';
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }
        $outputFile = $outputDir . '/' . $newId . '.geojson';

        try {
            $this->geoConverter->mergeGeoJsonFiles($geojsonFiles, $outputFile);
            $newLayer->setGeoJsonPath('/geojson/' . $newId . '.geojson');
            $newLayer->setConversionStatus('done');
            $newLayer->setMetadata($this->buildMetadata($outputFile));
        } catch (\Throwable $e) {
            $newLayer->setConversionStatus('error');
            $newLayer->setConversionError($e->getMessage());
        }

        $this->em->flush();

        return $this->json(['@id' => '/api/layers/' . $newId], 201);
    }

    private function buildMetadata(string $geojsonPath): array
    {
        $content = file_get_contents($geojsonPath);
        if ($content === false) {
            return [];
        }
        $json = json_decode($content, true);
        $features = $json['features'] ?? [];

        $types = [];
        foreach ($features as $feature) {
            $type = $feature['geometry']['type'] ?? null;
            if ($type !== null) {
                $types[$type] = true;
            }
        }

        return [
            'featureCount' => count($features),
            'geometryType' => count($types) === 1 ? array_key_first($types) : implode(', ', array_keys($types)),
        ];
    }
}
