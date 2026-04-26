<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Repository\ProjectRepository;
use App\State\ProjectProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: ProjectRepository::class)]
#[ApiResource(
    normalizationContext: ['groups' => ['project:read']],
    operations: [
        new GetCollection(),
        new Get(),
        new Delete(),
        new Post(deserialize: false, processor: ProjectProcessor::class),
        new Put(deserialize: false, processor: ProjectProcessor::class),
        new Patch(deserialize: false, processor: ProjectProcessor::class),
    ]
)]
class Project
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['project:read', 'layer:read', 'layer_group:read'])]
    private ?string $name = null;

    #[ORM\OneToMany(targetEntity: Layer::class, mappedBy: 'project', orphanRemoval: false)]
    #[Groups(['project:read'])]
    private Collection $layers;

    #[ORM\OneToMany(targetEntity: LayerGroup::class, mappedBy: 'project', orphanRemoval: false)]
    #[Groups(['project:read'])]
    private Collection $groups;

    public function __construct()
    {
        $this->layers = new ArrayCollection();
        $this->groups = new ArrayCollection();
    }

    public function getId(): ?Uuid { return $this->id; }

    public function getName(): ?string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getLayers(): Collection { return $this->layers; }

    public function addLayer(Layer $layer): static
    {
        if (!$this->layers->contains($layer)) {
            $this->layers->add($layer);
            $layer->setProject($this);
        }
        return $this;
    }

    public function removeLayer(Layer $layer): static
    {
        $this->layers->removeElement($layer);
        return $this;
    }

    public function getGroups(): Collection { return $this->groups; }

    public function addGroup(LayerGroup $group): static
    {
        if (!$this->groups->contains($group)) {
            $this->groups->add($group);
            $group->setProject($this);
        }
        return $this;
    }

    public function removeGroup(LayerGroup $group): static
    {
        $this->groups->removeElement($group);
        return $this;
    }
}
