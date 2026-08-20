import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapEnvelope } from '../envelope';

test('单层信封: 返回 data', () => {
  const payload = { code: '0', msg: 'ok', data: { id: 1 } };
  assert.deepEqual(unwrapEnvelope(payload), { id: 1 });
});

test('mica 嵌套信封: 递归解到业务数据', () => {
  const payload = {
    code: '0',
    msg: 'ok',
    data: { code: '0', msg: 'ok', data: { id: 2, name: 'x' } }
  };
  assert.deepEqual(unwrapEnvelope(payload), { id: 2, name: 'x' });
});

test('三层嵌套: 继续下钻', () => {
  const payload = {
    code: '0',
    msg: 'ok',
    data: { code: '0', msg: 'ok', data: { code: '0', msg: 'ok', data: [1, 2, 3] } }
  };
  assert.deepEqual(unwrapEnvelope(payload), [1, 2, 3]);
});

test('空 data: 返回 null', () => {
  assert.equal(unwrapEnvelope({ code: '0', msg: 'ok', data: null }), null);
  assert.equal(unwrapEnvelope({ code: '0', msg: 'ok' }), null);
});

test('非对象: 返回 null', () => {
  assert.equal(unwrapEnvelope(null), null);
  assert.equal(unwrapEnvelope(undefined), null);
  assert.equal(unwrapEnvelope('str'), null);
});

test('业务数据本身含 data 字段但不含 code: 不解包', () => {
  const payload = { code: '0', msg: 'ok', data: { data: [1, 2], total: 10 } };
  assert.deepEqual(unwrapEnvelope(payload), { data: [1, 2], total: 10 });
});

test('业务数据含 code 与 data 且形状像信封: 继续解包', () => {
  const payload = { code: '0', msg: 'ok', data: { code: '0', msg: 'ok', data: 'final' } };
  assert.equal(unwrapEnvelope(payload), 'final');
});
