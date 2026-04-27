<?php

namespace App\Controller;

use App\Entity\LayerGroup;
use App\Message\SplitLayerMessage;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

class SplitLayerController extends AbstractController
{
    public function __construct(
        private readonly LayerRepository $layerRepository,
        private readonly EntityManagerInterface $em,
        private readonly MessageBusInterface $bus,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    #[Route('/api/layers/{id}/split', name: 'api_layer_split', methods: ['POST'])]
    public function __invoke(string $id): JsonResponse
    {
        $layer = $this->layerRepository->find($id);

        if (!$layer) {
            throw new NotFoundHttpException('Layer not found.');
        }

        if ($layer->getConversionStatus() !== 'done' || !$layer->getGeoJsonPath()) {
            throw new UnprocessableEntityHttpException('Layer has no converted GeoJSON to split.');
        }

        $geoJsonPath = $this->projectDir . '/public' . $layer->getGeoJsonPath();

        if (!file_exists($geoJsonPath)) {
            throw new UnprocessableEntityHttpException('GeoJSON file not found on disk.');
        }

        $group = new LayerGroup();
        $group->setName($layer->getName() . ' (grid)');
        $group->setProject($layer->getProject());
        $group->setOriginLayer($layer);
        $group->setSplitStatus('pending');
        $this->em->persist($group);
        $this->em->flush();

        $groupId = (string) $group->getId();

        $this->bus->dispatch(new SplitLayerMessage($id, $groupId));

        return $this->json([
            '@id'     => '/api/layer_groups/' . $groupId,
            'groupId' => $groupId,
            'status'  => 'pending',
        ], 202);
    }
}
