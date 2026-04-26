<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add metadata JSON field to layer';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ADD metadata JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP metadata');
    }
}
