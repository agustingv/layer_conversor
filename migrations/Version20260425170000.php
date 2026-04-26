<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Drop detected_layers column from layer table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP COLUMN detected_layers');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ADD detected_layers JSON DEFAULT NULL');
    }
}
