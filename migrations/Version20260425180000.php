<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add created_at column to layer table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()');
        $this->addSql('ALTER TABLE layer ALTER COLUMN created_at DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP COLUMN created_at');
    }
}
