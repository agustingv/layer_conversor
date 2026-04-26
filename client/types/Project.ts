import { Item } from "./item";

export class Project implements Item {
  public "@id"?: string;

  constructor(
    _id?: string,
    public name?: string,
    public layers?: Array<string | { "@id"?: string; name?: string }>,
    public groups?: Array<string | { "@id"?: string; name?: string }>
  ) {
    this["@id"] = _id;
  }
}
