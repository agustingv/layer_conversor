<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Repository\LayerRepository;
use App\State\LayerProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\HttpFoundation\File\File;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Validator\Constraints as Assert;
use Vich\UploaderBundle\Mapping\Annotation as Vich;

#[ORM\Entity(repositoryClass: LayerRepository::class)]
#[Vich\Uploadable]
#[ApiFilter(SearchFilter::class, properties: ['project' => 'exact', 'group' => 'exact'])]
#[ApiResource(
    normalizationContext: ['groups' => ['layer:read']],
    operations: [
        new GetCollection(),
        new Get(),
        new Delete(),
        new Post(
            inputFormats: ['multipart' => ['multipart/form-data']],
            deserialize: false,
            processor: LayerProcessor::class,
        ),
        new Put(
            inputFormats: ['multipart' => ['multipart/form-data']],
            deserialize: false,
            processor: LayerProcessor::class,
        ),
        new Patch(
            inputFormats: ['multipart' => ['multipart/form-data']],
            deserialize: false,
            processor: LayerProcessor::class,
        ),
    ]
)]
class Layer
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['layer:read', 'project:read', 'layer_group:read'])]
    private ?string $name = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['layer:read'])]
    private ?string $description = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['layer:read'])]
    private ?string $geoJsonPath = null;

    #[ApiProperty(readable: false, writable: false)]
    #[Vich\UploadableField(mapping: 'layer_files', fileNameProperty: 'filePath')]
    private ?File $file = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['layer:read'])]
    private ?string $filePath = null;

    #[ORM\ManyToOne(inversedBy: 'layers')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['layer:read'])]
    private ?Project $project = null;

    #[ORM\ManyToOne(inversedBy: 'layers')]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['layer:read'])]
    private ?LayerGroup $group = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['layer:read'])]
    private ?string $conversionStatus = null;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['layer:read'])]
    private bool $merged = false;

    /** @var string[]|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['layer:read'])]
    private ?array $sourceLayerIris = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['layer:read'])]
    private ?array $metadata = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['layer:read'])]
    private ?string $conversionError = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['layer:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\Column]
    #[Groups(['layer:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?Uuid { return $this->id; }

    public function getName(): ?string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): static { $this->description = $description; return $this; }

    public function getGeoJsonPath(): ?string { return $this->geoJsonPath; }
    public function setGeoJsonPath(?string $geoJsonPath): static { $this->geoJsonPath = $geoJsonPath; return $this; }

    public function getFile(): ?File { return $this->file; }
    public function setFile(?File $file): static {
        $this->file = $file;
        if ($file !== null) $this->updatedAt = new \DateTimeImmutable();
        return $this;
    }

    public function getFilePath(): ?string { return $this->filePath; }
    public function setFilePath(?string $filePath): static { $this->filePath = $filePath; return $this; }

    #[Groups(['layer:read'])]
    public function getFileUrl(): ?string
    {
        return $this->filePath ? '/api/layers/file/' . $this->filePath : null;
    }

    public function getProject(): ?Project { return $this->project; }
    public function setProject(?Project $project): static { $this->project = $project; return $this; }

    public function getGroup(): ?LayerGroup { return $this->group; }
    public function setGroup(?LayerGroup $group): static { $this->group = $group; return $this; }

    public function getConversionStatus(): ?string { return $this->conversionStatus; }
    public function setConversionStatus(?string $conversionStatus): static { $this->conversionStatus = $conversionStatus; return $this; }

    public function isMerged(): bool { return $this->merged; }
    public function setMerged(bool $merged): static { $this->merged = $merged; return $this; }

    /** @return string[]|null */
    public function getSourceLayerIris(): ?array { return $this->sourceLayerIris; }
    /** @param string[]|null $sourceLayerIris */
    public function setSourceLayerIris(?array $sourceLayerIris): static { $this->sourceLayerIris = $sourceLayerIris; return $this; }

    /** @return array<string, mixed>|null */
    public function getMetadata(): ?array { return $this->metadata; }
    public function setMetadata(?array $metadata): static { $this->metadata = $metadata; return $this; }

    public function getConversionError(): ?string { return $this->conversionError; }
    public function setConversionError(?string $conversionError): static { $this->conversionError = $conversionError; return $this; }

    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static { $this->updatedAt = $updatedAt; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
