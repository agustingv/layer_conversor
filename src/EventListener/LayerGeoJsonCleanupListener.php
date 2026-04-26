<?php

namespace App\EventListener;

use App\Entity\Layer;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Events;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsEntityListener(event: Events::preRemove, entity: Layer::class)]
class LayerGeoJsonCleanupListener
{
    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {}

    public function preRemove(Layer $layer): void
    {
        $layerId = (string) $layer->getId();
        if (!$layerId) {
            return;
        }

        $file = $this->projectDir . '/public/geojson/' . $layerId . '.geojson';
        if (file_exists($file)) {
            unlink($file);
        }
    }
}
