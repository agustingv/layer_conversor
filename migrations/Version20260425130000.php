<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add conversion_error text field to layer';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ADD conversion_error TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP conversion_error');
    }
}
