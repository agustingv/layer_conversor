<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260427000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add origin_layer_id to layer_group';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer_group ADD origin_layer_id UUID DEFAULT NULL');
        $this->addSql('COMMENT ON COLUMN layer_group.origin_layer_id IS \'(DC2Type:uuid)\'');
        $this->addSql('ALTER TABLE layer_group ADD CONSTRAINT FK_layer_group_origin_layer FOREIGN KEY (origin_layer_id) REFERENCES layer (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_layer_group_origin_layer ON layer_group (origin_layer_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer_group DROP CONSTRAINT FK_layer_group_origin_layer');
        $this->addSql('DROP INDEX IDX_layer_group_origin_layer');
        $this->addSql('ALTER TABLE layer_group DROP origin_layer_id');
    }
}
