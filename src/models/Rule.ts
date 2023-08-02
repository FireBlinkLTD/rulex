import { Action } from "./Action";
import { Condition } from "./Condition";

export class Rule {
  public name: string;
  public conditions: Condition[] = [];
  public actions: Action[] = [];
  public break: boolean = false;
  public error: string = null;
  public errorCode: string = null;
}