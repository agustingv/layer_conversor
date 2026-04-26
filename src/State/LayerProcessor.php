<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Layer;
use App\Repository\LayerGroupRepository;
use App\Repository\ProjectRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class LayerProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $em,
        private RequestStack $requestStack,
        private ProjectRepository $projectRepository,
        private LayerGroupRepository $layerGroupRepository,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $request = $this->requestStack->getCurrentRequest();
        $layer = $data instanceof Layer ? $data : new Layer();

        $name = $request?->request->get('name');
        $description = $request?->request->get('description');
        $projectIri = $request?->request->get('project');
        $groupIri = $request?->request->get('group');
        $file = $request?->files->get('file');

        if ($name !== null) $layer->setName($name);
        if ($description !== null) $layer->setDescription($description);

        if ($projectIri) {
            $projectId = basename($projectIri);
            $project = $this->projectRepository->find($projectId);
            if ($project) $layer->setProject($project);
        }

        if ($request?->request->has('group')) {
            if ($groupIri) {
                $groupId = basename($groupIri);
                $group = $this->layerGroupRepository->find($groupId);
                if ($group) {
                    $layer->setGroup($group);
                    if (!$projectIri && $group->getProject()) {
                        $layer->setProject($group->getProject());
                    }
                }
            } else {
                $layer->setGroup(null);
            }
        }

        if ($file) {
            $layer->setFile($file);
            $layer->setConversionStatus(null);
            $layer->setGeoJsonPath(null);
        }

        $this->em->persist($layer);
        $this->em->flush();

        return $layer;
    }
}
