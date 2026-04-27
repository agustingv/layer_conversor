<?php

namespace App\Message;

class SplitLayerMessage
{
    public function __construct(
        public readonly string $layerId,
        public readonly string $groupId,
    ) {}
}
