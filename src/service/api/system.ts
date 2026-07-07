import { request } from '../request/real';

// ==================== 用户管理 ====================

/** 用户分页列表 */
export function fetchUserPage(params: Api.System.UserQuery) {
  return request<Api.System.PageResult<Api.System.UserItem>>({
    url: '/system/user',
    params
  });
}

/** 用户详情 */
export function fetchUserDetail(id: number) {
  return request<Api.System.UserDetail>({
    url: `/system/user/${id}`
  });
}

/** 新增用户 */
export function fetchUserCreate(data: Api.System.UserForm) {
  return request<Api.System.IdResp>({
    url: '/system/user',
    method: 'post',
    data
  });
}

/** 编辑用户 */
export function fetchUserUpdate(id: number, data: Api.System.UserForm) {
  return request<void>({
    url: `/system/user/${id}`,
    method: 'put',
    data
  });
}

/** 删除用户 */
export function fetchUserDelete(ids: number[]) {
  return request<void>({
    url: '/system/user',
    method: 'delete',
    data: ids
  });
}

/** 重置用户密码 */
export function fetchUserResetPassword(id: number, password: string) {
  return request<void>({
    url: `/system/user/${id}/password`,
    method: 'patch',
    data: { password }
  });
}

// ==================== 角色管理 ====================

/** 角色列表 */
export function fetchRoleList(params?: Api.System.RoleQuery) {
  return request<Api.System.RoleItem[]>({
    url: '/system/role/list',
    params
  });
}

/** 角色详情 */
export function fetchRoleDetail(id: number) {
  return request<Api.System.RoleDetail>({
    url: `/system/role/${id}`
  });
}

/** 新增角色 */
export function fetchRoleCreate(data: Api.System.RoleForm) {
  return request<Api.System.IdResp>({
    url: '/system/role',
    method: 'post',
    data
  });
}

/** 编辑角色 */
export function fetchRoleUpdate(id: number, data: Api.System.RoleForm) {
  return request<void>({
    url: `/system/role/${id}`,
    method: 'put',
    data
  });
}

/** 删除角色 */
export function fetchRoleDelete(ids: number[]) {
  return request<void>({
    url: '/system/role',
    method: 'delete',
    data: ids
  });
}

/** 获取权限树 */
export function fetchPermissionTree() {
  return request<Api.System.PermissionTreeNode[]>({
    url: '/system/role/permission/tree'
  });
}

/** 分配角色权限 */
export function fetchRoleUpdatePermission(id: number, menuIds: number[]) {
  return request<void>({
    url: `/system/role/${id}/permission`,
    method: 'put',
    data: { menuIds }
  });
}

// ==================== 菜单管理 ====================

/** 菜单树 */
export function fetchMenuTree() {
  return request<Api.System.MenuItem[]>({
    url: '/system/menu/tree'
  });
}

/** 菜单详情 */
export function fetchMenuDetail(id: number) {
  return request<Api.System.MenuItem>({
    url: `/system/menu/${id}`
  });
}

/** 新增菜单 */
export function fetchMenuCreate(data: Api.System.MenuForm) {
  return request<Api.System.IdResp>({
    url: '/system/menu',
    method: 'post',
    data
  });
}

/** 编辑菜单 */
export function fetchMenuUpdate(id: number, data: Api.System.MenuForm) {
  return request<void>({
    url: `/system/menu/${id}`,
    method: 'put',
    data
  });
}

/** 删除菜单 */
export function fetchMenuDelete(ids: number[]) {
  return request<void>({
    url: '/system/menu',
    method: 'delete',
    data: ids
  });
}
