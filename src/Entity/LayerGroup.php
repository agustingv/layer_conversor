<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Repository\LayerGroupRepository;
use App\State\LayerGroupProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: LayerGroupRepository::class)]
#[ApiFilter(SearchFilter::class, properties: ['project' => 'exact'])]
#[ApiResource(
    normalizationContext: ['groups' => ['layer_group:read']],
    operations: [
        new GetCollection(),
        new Get(),
        new Delete(),
        new Post(deserialize: false, processor: LayerGroupProcessor::class),
        new Put(deserialize: false, processor: LayerGroupProcessor::class),
        new Patch(deserialize: false, processor: LayerGroupProcessor::class),
    ]
)]
class LayerGroup
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['layer_group:read', 'project:read', 'layer:read'])]
    private ?string $name = null;

    #[ORM\ManyToOne(inversedBy: 'groups')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['layer_group:read'])]
    private ?Project $project = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['layer_group:read'])]
    private ?string $splitStatus = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['layer_group:read'])]
    private ?Layer $originLayer = null;

    #[ORM\OneToMany(targetEntity: Layer::class, mappedBy: 'group', orphanRemoval: false)]
    #[Groups(['layer_group:read'])]
    private Collection $layers;

    public function __construct()
    {
        $this->layers = new ArrayCollection();
    }

    public function getId(): ?Uuid { return $this->id; }

    public function getName(): ?string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getProject(): ?Project { return $this->project; }
    public function setProject(?Project $project): static { $this->project = $project; return $this; }

    public function getSplitStatus(): ?string { return $this->splitStatus; }
    public function setSplitStatus(?string $splitStatus): static { $this->splitStatus = $splitStatus; return $this; }

    public function getOriginLayer(): ?Layer { return $this->originLayer; }
    public function setOriginLayer(?Layer $originLayer): static { $this->originLayer = $originLayer; return $this; }

    public function getLayers(): Collection { return $this->layers; }

    public function addLayer(Layer $layer): static
    {
        if (!$this->layers->contains($layer)) {
            $this->layers->add($layer);
            $layer->setGroup($this);
        }
        return $this;
    }

    public function removeLayer(Layer $layer): static
    {
        if ($this->layers->removeElement($layer)) {
            if ($layer->getGroup() === $this) {
                $layer->setGroup(null);
            }
        }
        return $this;
    }
}
