<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260426105502 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE layer ADD merged BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('COMMENT ON COLUMN layer.group_id IS \'\'');
        $this->addSql('ALTER INDEX idx_layer_group_id RENAME TO IDX_E4DB211AFE54D947');
        $this->addSql('COMMENT ON COLUMN layer_group.id IS \'\'');
        $this->addSql('COMMENT ON COLUMN layer_group.project_id IS \'\'');
        $this->addSql('ALTER INDEX idx_layer_group_project_id RENAME TO IDX_E6AAC9F4166D1F9C');
        $this->addSql('COMMENT ON COLUMN "user".id IS \'\'');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE layer DROP merged');
        $this->addSql('COMMENT ON COLUMN layer.group_id IS \'(DC2Type:uuid)\'');
        $this->addSql('ALTER INDEX idx_e4db211afe54d947 RENAME TO idx_layer_group_id');
        $this->addSql('COMMENT ON COLUMN layer_group.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN layer_group.project_id IS \'(DC2Type:uuid)\'');
        $this->addSql('ALTER INDEX idx_e6aac9f4166d1f9c RENAME TO idx_layer_group_project_id');
        $this->addSql('COMMENT ON COLUMN "user".id IS \'(DC2Type:uuid)\'');
    }
}
