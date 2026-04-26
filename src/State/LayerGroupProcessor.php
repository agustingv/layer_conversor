<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\LayerGroup;
use App\Repository\LayerRepository;
use App\Repository\ProjectRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class LayerGroupProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $em,
        private RequestStack $requestStack,
        private ProjectRepository $projectRepository,
        private LayerRepository $layerRepository,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $request = $this->requestStack->getCurrentRequest();
        $body = json_decode($request->getContent(), true) ?? [];

        $group = $data instanceof LayerGroup ? $data : new LayerGroup();

        if (isset($body['name'])) {
            $group->setName($body['name']);
        }

        if (isset($body['project'])) {
            $projectId = basename((string) $body['project']);
            $project = $this->projectRepository->find($projectId);
            if ($project) {
                $group->setProject($project);
            }
        }

        $this->em->persist($group);
        $this->em->flush();

        if (array_key_exists('layers', $body)) {
            foreach ($group->getLayers()->toArray() as $existingLayer) {
                $existingLayer->setGroup(null);
            }

            foreach ($body['layers'] as $layerIri) {
                $layerId = basename((string) $layerIri);
                $layer = $this->layerRepository->find($layerId);
                if ($layer) {
                    $layer->setGroup($group);
                    if ($group->getProject()) {
                        $layer->setProject($group->getProject());
                    }
                }
            }
            $this->em->flush();
        }

        $this->em->refresh($group);

        return $group;
    }
}
