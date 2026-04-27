<?php

namespace App\Message;

class ConvertLayerFileMessage
{
    public function __construct(
        public readonly string $layerId,
        public readonly bool $merge = false,
    ) {}
}
