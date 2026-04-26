<?php

namespace App\Controller;

use App\Repository\LayerRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

class LayerFileController extends AbstractController
{
    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    #[Route('/api/layers/file/{filename}', name: 'layer_file_serve', methods: ['GET'])]
    public function serve(string $filename, LayerRepository $layerRepository): BinaryFileResponse
    {
        $layer = $layerRepository->findOneBy(['filePath' => $filename]);

        if (!$layer) {
            throw new NotFoundHttpException('File not found.');
        }

        $path = $this->projectDir . '/var/private/layers/' . $filename;

        if (!file_exists($path)) {
            throw new NotFoundHttpException('File not found.');
        }

        return $this->file($path, $filename, ResponseHeaderBag::DISPOSITION_INLINE);
    }
}
