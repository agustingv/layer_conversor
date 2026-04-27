<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260427000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add split_status to layer_group';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer_group ADD split_status VARCHAR(20) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE layer_group DROP split_status');
    }
}
