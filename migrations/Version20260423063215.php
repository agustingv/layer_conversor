<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260423063215 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE layer ADD name VARCHAR(255) NOT NULL');
        $this->addSql('ALTER TABLE layer ADD file_path VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE layer ADD updated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE layer DROP name');
        $this->addSql('ALTER TABLE layer DROP file_path');
        $this->addSql('ALTER TABLE layer DROP updated_at');
    }
}
