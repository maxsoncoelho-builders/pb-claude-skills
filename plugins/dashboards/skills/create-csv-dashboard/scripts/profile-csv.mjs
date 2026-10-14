#!/usr/bin/env node
/**
 * Perfila um CSV e devolve JSON: colunas, tipos, papéis, faixas e sinais de PII.
 *
 * Existe para a skill `create-csv-dashboard` fazer perguntas dirigidas sem
 * carregar o arquivo inteiro no contexto — só o perfil agregado entra.
 *
 * Uso (raiz do repo):
 *   node .claude/skills/skills-tools/create-csv-dashboard/scripts/profile-csv.mjs \
 *     --input caminho/arquivo.csv [--json saida.json] [--sample 20000]
 */
import fs from 'node:fs';
import path from 'node:path';

const PII_BY_NAME = [
  [/\b(cpf|cnpj|documento|doc_?num)\b/i, 'documento'],
  [/\b(e-?mail|email)\b/i, 'email'],
  [/\b(telefone|celular|phone|msisdn)\b/i, 'telefone'],
  [/\b(nome|name|nome_?completo|full_?name)\b/i, 'nome'],
  [/\b(matricula|matrícula|employee_?id|registration)\b/i, 'matricula'],
  [/\b(endereco|endereço|address|cep|zip)\b/i, 'endereco'],
  [/\b(token|senha|password|secret|api_?key)\b/i, 'segredo'],
];

const PII_BY_VALUE = [
  [/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i, 'email'],
  [/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'documento'],
  [/^\+?\d{2}\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, 'telefone'],
];

function usage(code = 1) {
  console.error(
    'Uso: node profile-csv.mjs --input <arquivo.csv> [--json <saida.json>] [--sample <n>]',
  );
  process.exit(code);
}

function parseArgs(argv) {
  const args = { sample: 50000 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--input') args.input = argv[++i];
    else if (key === '--json') args.json = argv[++i];
    else if (key === '--sample') args.sample = Number(argv[++i]);
    else if (key === '--help' || key === '-h') usage(0);
  }
  if (!args.input) usage();
  return args;
}

function detectDelimiter(headerLine) {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitLine(headerLine, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function splitLine(line, delimiter) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields.map((value) => value.trim());
}

// Firebase exporta "Galaxy A10s, Samsung",1234 — campos a mais à esquerda são o rótulo.
function alignRow(fields, width) {
  if (fields.length <= width) return fields;
  const extra = fields.length - width;
  const merged = fields.slice(0, extra + 1).join(', ');
  return [merged, ...fields.slice(extra + 1)];
}

function parseNumber(raw) {
  if (raw === '' || raw == null) return null;
  let value = String(raw).trim();
  const isPercent = value.endsWith('%');
  value = value.replace(/^R\$\s*/i, '').replace(/%$/, '').trim();
  if (!/^-?[\d.,\s]+$/.test(value)) return null;
  value = value.replace(/\s/g, '');
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  const milharPonto = /^-?\d{1,3}(\.\d{3})+$/.test(value);
  const milharVirgula = /^-?\d{1,3}(,\d{3})+$/.test(value);
  if (milharPonto) value = value.replace(/\./g, '');
  else if (milharVirgula) value = value.replace(/,/g, '');
  else if (lastComma > lastDot) value = value.replace(/\./g, '').replace(',', '.');
  else value = value.replace(/,/g, '');
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return { value: parsed, isPercent };
}

function parseDate(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  match = value.match(/^(\d{8})$/);
  if (match) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return null;
}

function detectPii(name, values) {
  for (const [pattern, label] of PII_BY_NAME) {
    if (pattern.test(name)) return label;
  }
  const amostra = values.slice(0, 50);
  for (const [pattern, label] of PII_BY_VALUE) {
    const hits = amostra.filter((value) => pattern.test(value)).length;
    if (hits >= Math.max(3, amostra.length * 0.3)) return label;
  }
  return null;
}

function profileColumn(name, index, rawValues) {
  const values = rawValues.filter((value) => value !== '');
  const nullRate = rawValues.length
    ? 1 - values.length / rawValues.length
    : 1;

  const dates = values.map(parseDate).filter(Boolean);
  const numbers = values.map(parseNumber).filter(Boolean);
  const unique = new Set(values);

  const column = {
    name,
    index,
    nonNull: values.length,
    nullRate: Number(nullRate.toFixed(3)),
    unique: unique.size,
    pii: detectPii(name, values),
  };

  const isDate = dates.length >= values.length * 0.9 && values.length > 0;
  const isNumber = numbers.length >= values.length * 0.9 && values.length > 0;

  if (isDate) {
    const ordered = dates.slice().sort();
    column.type = 'data';
    column.role = 'tempo';
    column.min = ordered[0];
    column.max = ordered[ordered.length - 1];
    column.distinctDays = new Set(dates).size;
  } else if (isNumber) {
    const nums = numbers.map((entry) => entry.value);
    const sum = nums.reduce((acc, value) => acc + value, 0);
    column.type = numbers.every((entry) => entry.isPercent)
      ? 'percentual'
      : 'numero';
    column.role = 'metrica';
    column.min = Math.min(...nums);
    column.max = Math.max(...nums);
    column.sum = Number(sum.toFixed(4));
    column.mean = Number((sum / nums.length).toFixed(4));
  } else {
    const ratio = values.length ? unique.size / values.length : 0;
    column.type = 'texto';
    column.role = ratio > 0.9 && values.length > 20 ? 'identificador' : 'dimensao';
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    column.topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ valor: value.slice(0, 60), linhas: count }));
  }

  // Coluna com PII nunca é métrica: somar CPF/telefone é sempre erro de leitura.
  if (column.pii) {
    column.role = 'identificador';
    delete column.sum;
    delete column.mean;
    delete column.topValues;
  }

  return column;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = path.resolve(args.input);
  if (!fs.existsSync(file)) {
    console.error(`Arquivo não encontrado: ${file}`);
    process.exit(2);
  }

  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    console.error('CSV sem linhas de dado (cabeçalho + 1 linha, no mínimo).');
    process.exit(2);
  }

  // Export do Firebase começa com linhas de metadado antes do cabeçalho real.
  let headerIndex = 0;
  const delimiterGuess = detectDelimiter(lines[0]);
  for (let i = 0; i < Math.min(lines.length, 15); i += 1) {
    if (splitLine(lines[i], delimiterGuess).length > 1) {
      headerIndex = i;
      break;
    }
  }

  const delimiter = detectDelimiter(lines[headerIndex]);
  const header = splitLine(lines[headerIndex], delimiter);
  const width = header.length;
  const body = lines.slice(headerIndex + 1);
  const sampled = body.slice(0, args.sample);

  const columns = header.map(() => []);
  let malformed = 0;
  for (const line of sampled) {
    const fields = alignRow(splitLine(line, delimiter), width);
    if (fields.length !== width) {
      malformed += 1;
      continue;
    }
    for (let i = 0; i < width; i += 1) columns[i].push(fields[i]);
  }

  const profile = {
    arquivo: path.relative(process.cwd(), file).startsWith('..') ? file : path.relative(process.cwd(), file),
    delimitador: delimiter === '\t' ? '\\t' : delimiter,
    linhasTotais: body.length,
    linhasAmostradas: sampled.length - malformed,
    linhasIgnoradas: malformed,
    metadadoAntesDoCabecalho: headerIndex,
    colunas: header.map((name, index) => profileColumn(name, index, columns[index])),
    avisos: [],
  };

  const tempo = profile.colunas.filter((column) => column.role === 'tempo');
  if (tempo.length) {
    profile.janela = { coluna: tempo[0].name, de: tempo[0].min, ate: tempo[0].max };
  } else {
    profile.avisos.push('Nenhuma coluna de data: o dashboard não terá série temporal.');
  }

  const pii = profile.colunas.filter((column) => column.pii);
  if (pii.length) {
    profile.avisos.push(
      `PII detectada em: ${pii.map((c) => `${c.name} (${c.pii})`).join(', ')} — agregar, nunca publicar linha a linha.`,
    );
  }
  if (!profile.colunas.some((column) => column.role === 'metrica')) {
    profile.avisos.push('Nenhuma coluna numérica: só dá para montar contagens.');
  }
  if (malformed) {
    profile.avisos.push(`${malformed} linha(s) com número de campos diferente do cabeçalho.`);
  }

  const output = JSON.stringify(profile, null, 2);
  if (args.json) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(path.resolve(args.json), output);
    console.log(`Perfil gravado em ${args.json}`);
  }
  console.log(output);
}

main();
