import { Item } from "./item";

export interface LayerMetadata {
  geometryType?: string;
  featureCount?: number;
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
  crs?: string;
  fields?: { name: string; type: string }[];
}

export class Layer implements Item {
  public "@id"?: string;

  constructor(
    _id?: string,
    public name?: string,
    public description?: string | null,
    public geoJsonPath?: string | null,
    public file?: any,
    public filePath?: string,
    public project?: string | { "@id"?: string; name?: string },
    public group?: string | { "@id"?: string; name?: string } | null,
    public conversionStatus?: string | null,
    public conversionError?: string | null,
    public metadata?: LayerMetadata | null,
    public updatedAt?: Date,
    public createdAt?: Date
  ) {
    this["@id"] = _id;
  }
}
