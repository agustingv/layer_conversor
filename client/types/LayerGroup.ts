import { Item } from "./item";

export class LayerGroup implements Item {
  public "@id"?: string;

  constructor(
    _id?: string,
    public name?: string,
    public project?: string | { "@id"?: string; name?: string },
    public layers?: Array<string | { "@id"?: string; name?: string }>
  ) {
    this["@id"] = _id;
  }
}
