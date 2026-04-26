<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260423062712 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE layer (id UUID NOT NULL, content TEXT NOT NULL, project_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_E4DB211A166D1F9C ON layer (project_id)');
        $this->addSql('ALTER TABLE layer ADD CONSTRAINT FK_E4DB211A166D1F9C FOREIGN KEY (project_id) REFERENCES project (id) NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE layer DROP CONSTRAINT FK_E4DB211A166D1F9C');
        $this->addSql('DROP TABLE layer');
    }
}
