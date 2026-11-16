// The public types' reference, read from the TypeScript sources with the
// compiler API: the bundled .d.ts renames types (`ColumnDef$1`), the sources
// don't. Runs at build time, in Node.
import { dirname } from 'node:path';
import ts from 'typescript';

export interface TypeMember {
  name: string;
  optional: boolean;
  /** As written in the source, with the alias's type parameter names. */
  type: string;
  description: string;
}

export interface TypeRef {
  /** The exported name, e.g. `ColumnDef`. */
  name: string;
  /** `interface` for interfaces and aliases of one; `type` for other aliases. */
  kind: 'interface' | 'type';
  /** `<T = unknown, TContent = CellContent>`, or `''`. */
  typeParameters: string;
  description: string;
  members: TypeMember[];
  /** Other aliases: the type, e.g. `'asc' | 'desc'`. */
  definition?: string;
}

const typeParametersOf = (decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): string =>
  decl.typeParameters ? `<${decl.typeParameters.map((p) => p.getText()).join(', ')}>` : '';

const docOf = (symbol: ts.Symbol | undefined, checker: ts.TypeChecker): string =>
  symbol ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim() : '';

/** Replaces whole-word type parameter names, e.g. `TData` → `T`. */
function rename(text: string, names: ReadonlyMap<string, string>): string {
  if (names.size === 0) return text;
  const pattern = new RegExp(`\\b(${[...names.keys()].join('|')})\\b`, 'g');
  return text.replace(pattern, (name) => names.get(name) ?? name);
}

/** A member's type as written; methods as a function type. */
function memberText(member: ts.Declaration): string | undefined {
  if (ts.isPropertySignature(member)) return member.type?.getText();
  if (ts.isMethodSignature(member)) {
    const params = member.parameters.map((p) => p.getText()).join(', ');
    return `(${params}) => ${member.type?.getText() ?? 'void'}`;
  }
  return undefined;
}

/** The interface's members, own and inherited, in declaration order. */
function membersOf(
  decl: ts.InterfaceDeclaration,
  checker: ts.TypeChecker,
  names: ReadonlyMap<string, string>,
): TypeMember[] {
  const symbol = checker.getSymbolAtLocation(decl.name);
  if (!symbol) return [];
  return checker
    .getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))
    .flatMap((property) => {
      const member = property.declarations?.[0];
      const text = member && memberText(member);
      if (text === undefined) return [];
      return [
        {
          name: property.getName(),
          optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
          type: rename(text, names),
          description: docOf(property, checker),
        },
      ];
    });
}

/** The interface an alias names directly (`CoreColumnDef<T, TContent>`), if it does. */
function aliasedInterface(
  decl: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): { decl: ts.InterfaceDeclaration; args: readonly ts.TypeNode[] } | undefined {
  if (!ts.isTypeReferenceNode(decl.type)) return undefined;
  let symbol = checker.getSymbolAtLocation(decl.type.typeName);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const target = symbol?.declarations?.find(ts.isInterfaceDeclaration);
  return target ? { decl: target, args: decl.type.typeArguments ?? [] } : undefined;
}

/**
 * The types `entry` exports (interfaces and type aliases, by their exported
 * names), sorted by name, compiled with `tsconfig`'s options.
 */
export function readTypes(entry: string, tsconfig: string): TypeRef[] {
  const config = ts.readConfigFile(tsconfig, (path) => ts.sys.readFile(path));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(tsconfig));
  const program = ts.createProgram([entry], { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const module = source && checker.getSymbolAtLocation(source);
  if (!module) throw new Error(`readTypes: can't read ${entry}`);

  const types: TypeRef[] = [];
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const decl = symbol.declarations?.find(
      (d): d is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
        ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d),
    );
    if (!decl) continue;
    const name = exported.getName();
    const description = docOf(symbol, checker);
    if (ts.isInterfaceDeclaration(decl)) {
      types.push({
        name,
        kind: 'interface',
        typeParameters: typeParametersOf(decl),
        description,
        members: membersOf(decl, checker, new Map()),
      });
      continue;
    }
    const target = aliasedInterface(decl, checker);
    if (target) {
      // The interface's type parameters read as the alias passes them: TData → T.
      const names = new Map(
        (target.decl.typeParameters ?? []).flatMap((p, i) => {
          const arg = target.args[i]?.getText();
          return arg && arg !== p.name.text ? [[p.name.text, arg] as const] : [];
        }),
      );
      const targetSymbol = checker.getSymbolAtLocation(target.decl.name);
      types.push({
        name,
        kind: 'interface',
        typeParameters: typeParametersOf(decl),
        description: description || docOf(targetSymbol, checker),
        members: membersOf(target.decl, checker, names),
      });
      continue;
    }
    types.push({
      name,
      kind: 'type',
      typeParameters: typeParametersOf(decl),
      description,
      members: [],
      definition: decl.type.getText(),
    });
  }
  return types.sort((a, b) => a.name.localeCompare(b.name));
}
