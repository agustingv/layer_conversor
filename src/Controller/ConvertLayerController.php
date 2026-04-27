<?php

namespace App\Controller;

use App\GeoConverter\GeoConverterService;
use App\Message\ConvertLayerFileMessage;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

class ConvertLayerController extends AbstractController
{
    public function __construct(
        private readonly LayerRepository $layerRepository,
        private readonly EntityManagerInterface $em,
        private readonly GeoConverterService $geoConverter,
        private readonly MessageBusInterface $bus,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    #[Route('/api/layers/{id}/convert', name: 'api_layer_convert', methods: ['POST'])]
    public function __invoke(string $id, Request $request): JsonResponse
    {
        $layer = $this->layerRepository->find($id);

        if (!$layer) {
            throw new NotFoundHttpException('Layer not found.');
        }

        if (!$layer->getFilePath()) {
            return $this->json(['error' => 'This layer has no file to convert.'], 400);
        }

        $filePath = $this->projectDir . '/var/private/layers/' . $layer->getFilePath();

        if (!file_exists($filePath)) {
            return $this->json(['error' => 'File not found on disk.'], 400);
        }

        $body = json_decode($request->getContent(), true) ?? [];
        $confirmed = (bool) ($body['confirmed'] ?? false);

        if (!$confirmed) {
            $detectedLayers = $this->geoConverter->detectLayers($filePath);
            if (count($detectedLayers) >= 1) {
                $groups = $this->geoConverter->detectLayerGroups($filePath);
                return $this->json([
                    'confirmation_needed' => true,
                    'layers' => $detectedLayers,
                    'groups' => $groups,
                ]);
            }
        }

        $merge = (bool) ($body['merge'] ?? false);

        $layer->setConversionStatus('pending');
        $this->em->flush();
        $this->bus->dispatch(new ConvertLayerFileMessage($id, $merge));

        return $this->json(['status' => 'pending']);
    }
}
