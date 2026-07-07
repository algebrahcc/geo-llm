declare namespace Api {
  namespace System {
    /** 通用分页结果 */
    interface PageResult<T> {
      list: T[];
      total: number;
    }

    /** 通用 ID 响应（新增后返回） */
    interface IdResp {
      id: number;
    }

    // ==================== 用户管理 ====================

    /** 用户列表项 */
    interface UserItem {
      id: number;
      username: string;
      nickname: string;
      gender: number;
      email: string;
      phone: string;
      avatar: string;
      description: string;
      status: number;
      deptName: string;
      createTime: string;
    }

    /** 用户详情 */
    interface UserDetail extends UserItem {
      deptId: number;
      roleIds: number[];
      pwdResetTime: string;
    }

    /** 用户查询参数 */
    interface UserQuery {
      page: number;
      size: number;
      username?: string;
      nickname?: string;
      status?: number;
      deptId?: number;
      sort?: string;
    }

    /** 新增/编辑用户请求体 */
    interface UserForm {
      username: string;
      nickname: string;
      gender: number;
      email?: string;
      phone?: string;
      description?: string;
      status: number;
      deptId?: number;
      roleIds?: number[];
    }

    /** 重置密码请求体 */
    interface UserPasswordReset {
      password: string;
    }

    // ==================== 角色管理 ====================

    /** 角色列表项 */
    interface RoleItem {
      id: number;
      name: string;
      code: string;
      description: string;
      status: number;
      sort: number;
      createTime: string;
    }

    /** 角色详情 */
    interface RoleDetail extends RoleItem {
      menuIds: number[];
    }

    /** 角色查询参数 */
    interface RoleQuery {
      name?: string;
      code?: string;
      status?: number;
      sort?: string;
    }

    /** 新增/编辑角色请求体 */
    interface RoleForm {
      name: string;
      code: string;
      description?: string;
      status: number;
      sort: number;
    }

    /** 角色权限分配请求体 */
    interface RolePermissionUpdate {
      menuIds: number[];
    }

    /** 权限树节点 */
    interface PermissionTreeNode {
      id: number;
      parentId: number;
      title: string;
      type: number;
      permission: string;
      sort: number;
      children: PermissionTreeNode[];
    }

    // ==================== 菜单管理 ====================

    /** 菜单项 */
    interface MenuItem {
      id: number;
      parentId: number;
      title: string;
      type: number; // 1=目录 2=菜单 3=按钮
      path: string;
      name: string;
      component: string;
      redirect: string;
      icon: string;
      isExternal: boolean;
      isCache: boolean;
      isHidden: boolean;
      permission: string;
      sort: number;
      status: number;
      createTime: string;
      children: MenuItem[];
    }

    /** 新增/编辑菜单请求体 */
    interface MenuForm {
      parentId: number;
      title: string;
      type: number;
      path?: string;
      name?: string;
      component?: string;
      redirect?: string;
      icon?: string;
      isExternal: boolean;
      isCache: boolean;
      isHidden: boolean;
      permission?: string;
      sort: number;
      status: number;
    }

    // ==================== 部门管理（字典用） ====================

    /** 部门树节点 */
    interface DeptTreeNode {
      id: number;
      parentId: number;
      name: string;
      sort: number;
      status: number;
      children: DeptTreeNode[];
    }
  }
}
