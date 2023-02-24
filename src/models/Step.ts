import { Rule } from "./Rule";

export class Step {
  public readonly name: string;
  public readonly rules: Rule[];

  constructor(name: string, rules: Rule[]) {
    this.name = name;
    this.rules = rules;
  }
}