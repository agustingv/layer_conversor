<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260424100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add detectedLayers JSON field to layer';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ADD detected_layers JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP detected_layers');
    }
}
