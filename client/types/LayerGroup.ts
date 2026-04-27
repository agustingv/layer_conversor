import { Item } from "./item";

export class LayerGroup implements Item {
  public "@id"?: string;

  constructor(
    _id?: string,
    public name?: string,
    public project?: string | { "@id"?: string; name?: string },
    public layers?: Array<string | { "@id"?: string; name?: string }>,
    public originLayer?: string | { "@id"?: string; name?: string } | null,
  ) {
    this["@id"] = _id;
  }
}
