<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260425160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create layer_group table and add group_id to layer';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE layer_group (id UUID NOT NULL, project_id UUID NOT NULL, name VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('COMMENT ON COLUMN layer_group.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN layer_group.project_id IS \'(DC2Type:uuid)\'');
        $this->addSql('CREATE INDEX IDX_layer_group_project_id ON layer_group (project_id)');
        $this->addSql('ALTER TABLE layer_group ADD CONSTRAINT FK_layer_group_project_id FOREIGN KEY (project_id) REFERENCES project (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE layer ADD group_id UUID DEFAULT NULL');
        $this->addSql('COMMENT ON COLUMN layer.group_id IS \'(DC2Type:uuid)\'');
        $this->addSql('ALTER TABLE layer ADD CONSTRAINT FK_layer_group_id FOREIGN KEY (group_id) REFERENCES layer_group (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_layer_group_id ON layer (group_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer DROP CONSTRAINT FK_layer_group_id');
        $this->addSql('DROP INDEX IDX_layer_group_id');
        $this->addSql('ALTER TABLE layer DROP COLUMN group_id');
        $this->addSql('ALTER TABLE layer_group DROP CONSTRAINT FK_layer_group_project_id');
        $this->addSql('DROP TABLE layer_group');
    }
}
