<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rename content to description, add geo_json_path field';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer RENAME COLUMN content TO description');
        $this->addSql('ALTER TABLE layer ADD geo_json_path VARCHAR(255) DEFAULT NULL');
        // Migrate existing geojson paths out of description into the new field
        $this->addSql("UPDATE layer SET geo_json_path = description, description = NULL WHERE description LIKE '/geojson/%'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP geo_json_path');
        $this->addSql('ALTER TABLE layer RENAME COLUMN description TO content');
    }
}
