<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260424080000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Make layer.content nullable to support async geo file conversion';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer ALTER COLUMN content DROP NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql("UPDATE layer SET content = '' WHERE content IS NULL");
        $this->addSql('ALTER TABLE layer ALTER COLUMN content SET NOT NULL');
    }
}
