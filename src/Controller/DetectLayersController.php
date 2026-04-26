<?php

namespace App\Controller;

use App\GeoConverter\GeoConverterService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class DetectLayersController extends AbstractController
{
    public function __construct(private readonly GeoConverterService $geoConverter) {}

    #[Route('/api/layers/detect', name: 'api_layers_detect', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $file = $request->files->get('file');
        if (!$file) {
            return $this->json(['layers' => []]);
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $tmpName = uniqid('detect_', true) . ($ext ? '.' . $ext : '');
        $tmpDir = sys_get_temp_dir();
        $file->move($tmpDir, $tmpName);
        $tmpPath = $tmpDir . '/' . $tmpName;

        try {
            $layers = $this->geoConverter->detectLayers($tmpPath);
            return $this->json(['layers' => $layers]);
        } finally {
            if (file_exists($tmpPath)) {
                unlink($tmpPath);
            }
        }
    }
}
