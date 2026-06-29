import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/src/meta', () => ({ getPool: vi.fn() }))

import { getPool } from '../../server/src/meta'
import {
  deleteUser,
  getUser,
  listUserGrants,
  listUsers,
  updateUserRole
} from '../../server/src/users'

const mockPool = { query: vi.fn() }
vi.mocked(getPool).mockReturnValue(mockPool as never)

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const DS_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPool).mockReturnValue(mockPool as never)
})

describe('listUsers()', () => {
  it('retorna array de usuários', async () => {
    const users = [
      { id: USER_ID, email: 'a@test.com', name: 'Alice', role: 'admin', created_at: '2026-01-01' },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        email: 'b@test.com',
        name: 'Bob',
        role: 'user',
        created_at: '2026-01-02'
      }
    ]
    mockPool.query.mockResolvedValueOnce({ rows: users })

    const result = await listUsers()

    expect(result).toHaveLength(2)
    expect(result[0].email).toBe('a@test.com')
    expect(result[1].role).toBe('user')
  })

  it('retorna array vazio quando não há usuários', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await listUsers()

    expect(result).toEqual([])
  })
})

describe('getUser()', () => {
  it('retorna o usuário quando encontrado', async () => {
    const user = {
      id: USER_ID,
      email: 'a@test.com',
      name: 'Alice',
      role: 'admin',
      created_at: '2026-01-01'
    }
    mockPool.query.mockResolvedValueOnce({ rows: [user] })

    const result = await getUser(USER_ID)

    expect(result).not.toBeNull()
    expect(result?.id).toBe(USER_ID)
    expect(result?.role).toBe('admin')

    const [sql, params] = mockPool.query.mock.calls[0]
    expect(sql).toContain('where id = $1')
    expect(params[0]).toBe(USER_ID)
  })

  it('retorna null quando usuário não é encontrado', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await getUser('inexistente-id')

    expect(result).toBeNull()
  })
})

describe('updateUserRole()', () => {
  it('persiste role admin quando role é admin', async () => {
    const updated = {
      id: USER_ID,
      email: 'a@test.com',
      name: 'Alice',
      role: 'admin',
      created_at: '2026-01-01'
    }
    mockPool.query.mockResolvedValueOnce({ rows: [updated] })

    const result = await updateUserRole(USER_ID, 'admin')

    expect(result?.role).toBe('admin')
    const [, params] = mockPool.query.mock.calls[0]
    expect(params[0]).toBe('admin')
    expect(params[1]).toBe(USER_ID)
  })

  it('sanitiza role desconhecida para user', async () => {
    const updated = {
      id: USER_ID,
      email: 'a@test.com',
      name: 'Alice',
      role: 'user',
      created_at: '2026-01-01'
    }
    mockPool.query.mockResolvedValueOnce({ rows: [updated] })

    const result = await updateUserRole(USER_ID, 'superadmin')

    expect(result?.role).toBe('user')
    const [, params] = mockPool.query.mock.calls[0]
    // A query deve ter recebido 'user' como role sanitizada
    expect(params[0]).toBe('user')
  })

  it('retorna null quando usuário não existe', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await updateUserRole('inexistente', 'admin')

    expect(result).toBeNull()
  })
})

describe('deleteUser()', () => {
  it('retorna grantIds do usuário deletado', async () => {
    const grantId1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    const grantId2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: grantId1 }, { id: grantId2 }] }) // select grants
      .mockResolvedValueOnce({ rows: [] }) // delete user

    const result = await deleteUser(USER_ID)

    expect(result.grantIds).toEqual([grantId1, grantId2])
  })

  it('retorna array vazio quando usuário não tem grants', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] }) // select grants
      .mockResolvedValueOnce({ rows: [] }) // delete user

    const result = await deleteUser(USER_ID)

    expect(result.grantIds).toEqual([])
  })

  it('chama delete com o id correto', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })

    await deleteUser(USER_ID)

    const [deleteSql, deleteParams] = mockPool.query.mock.calls[1]
    expect(deleteSql).toContain('delete from users where id = $1')
    expect(deleteParams[0]).toBe(USER_ID)
  })
})

describe('listUserGrants()', () => {
  it('retorna grants do usuário', async () => {
    const grants = [
      {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        user_id: USER_ID,
        data_source_id: DS_ID,
        mode: 'read',
        created_at: '2026-01-01',
        expires_at: null,
        suspended: false,
        expired: false
      }
    ]
    mockPool.query.mockResolvedValueOnce({ rows: grants })

    const result = await listUserGrants(USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('read')
    expect(result[0].user_id).toBe(USER_ID)

    const [, params] = mockPool.query.mock.calls[0]
    expect(params[0]).toBe(USER_ID)
  })

  it('retorna array vazio quando usuário não tem grants', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await listUserGrants(USER_ID)

    expect(result).toEqual([])
  })
})
