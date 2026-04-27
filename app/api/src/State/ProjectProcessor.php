<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Project;
use App\Repository\LayerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class ProjectProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $em,
        private RequestStack $requestStack,
        private LayerRepository $layerRepository,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $request = $this->requestStack->getCurrentRequest();
        $body = json_decode($request->getContent(), true) ?? [];

        $project = $data instanceof Project ? $data : new Project();

        if (isset($body['name'])) {
            $project->setName($body['name']);
        }

        $this->em->persist($project);
        $this->em->flush();

        if (array_key_exists('layers', $body)) {
            foreach ($body['layers'] as $layerIri) {
                $layerId = basename((string) $layerIri);
                $layer = $this->layerRepository->find($layerId);
                if ($layer) {
                    $layer->setProject($project);
                }
            }
            $this->em->flush();
        }

        $this->em->refresh($project);

        return $project;
    }
}
