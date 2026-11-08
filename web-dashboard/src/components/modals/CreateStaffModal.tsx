import React, { useState } from 'react';
import { UserPlus, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { UserProfile, UserRole, UserAccount } from '../../types/rbac';
import { Warehouse } from '../../types/warehouse';
import { createUserAccount } from '../../services/storageService';
import { getRoleDefaultAvatar } from '../../services/avatarService';
import { DialogPortal, DialogOverlay, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/select';

export interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  warehouses: Warehouse[];
  existingUsers: UserAccount[];
  lang: 'ar' | 'en';
  onUserCreated: (user: UserAccount) => void;
}

export default function CreateStaffModal({
  isOpen,
  onClose,
  currentUser,
  warehouses,
  existingUsers,
  lang,
  onUserCreated
}: CreateStaffModalProps) {
  const isAr = lang === 'ar';

  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('Cashier');
  const [newBranchId, setNewBranchId] = useState<string>(() => {
    return warehouses[0]?.id || 'ALL';
  });
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState('');
  // Prevent browser password manager (Keychain / Chrome) from aggressively hijacking username input on mount
  const [isUsernameReadOnly, setIsUsernameReadOnly] = useState(true);

  if (!isOpen) return null;

  const resetForm = () => {
    setNewFullName('');
    setNewUsername('');
    setNewPassword('');
    setShowPassword(false);
    setNewRole('Cashier');
    setNewBranchId(warehouses[0]?.id || 'ALL');
    setNewPhone('');
    setNewNotes('');
    setFormError('');
    setIsUsernameReadOnly(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (newRole === 'SuperAdmin') {
      setFormError(
        isAr
          ? 'لا يمكن إنشاء حساب مدير عام آخر. مالك المنظومة فريد وغير قابل للتكرار.'
          : 'Cannot create another SuperAdmin. Root Owner is unique.'
      );
      return;
    }

    const cleanFullName = newFullName.trim();
    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const cleanPassword = newPassword.trim();

    if (!cleanFullName || !cleanUsername) {
      setFormError(
        isAr ? 'يرجى كتابة الاسم الكامل واسم المستخدم' : 'Please provide full name and username'
      );
      return;
    }

    if (!cleanPassword) {
      setFormError(
        isAr ? 'يرجى إدخال كلمة المرور الأولية للموظف' : 'Please provide an initial password'
      );
      return;
    }

    if (cleanPassword.length < 6) {
      setFormError(
        isAr ? 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام' : 'Password must be at least 6 characters'
      );
      return;
    }

    // Validate phone number: prevent junk like "w"
    const cleanedPhone = newPhone.trim();
    if (cleanedPhone && !/^[0-9+\s\-()]{4,20}$/.test(cleanedPhone)) {
      setFormError(
        isAr ? 'يرجى إدخال رقم هاتف صحيح بالأرقام فقط أو تركه فارغاً' : 'Please enter a valid phone number or leave it blank'
      );
      return;
    }

    const tenantSlug = (currentUser.tenantSlug || 'a').toLowerCase();
    const fullUsername = tenantSlug ? `${cleanUsername}@${tenantSlug}` : cleanUsername;

    if (
      existingUsers.some(
        (u) =>
          u.username.toLowerCase() === fullUsername ||
          u.username.toLowerCase() === cleanUsername
      )
    ) {
      setFormError(
        isAr
          ? 'اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر'
          : 'Username already exists, please choose another'
      );
      return;
    }

    const targetBranch =
      currentUser.role === 'BranchManager' ? currentUser.branchId : newBranchId;
    const branchObj = warehouses.find((w) => w.id === targetBranch);
    const resolvedBranchName = branchObj
      ? (isAr ? branchObj.nameAr : (branchObj.nameEn || branchObj.nameAr))
      : targetBranch === 'ALL'
      ? (isAr ? 'كافة الفروع والمستودعات' : 'All Branches & Warehouses')
      : targetBranch;

    const created = createUserAccount({
      fullName: cleanFullName,
      username: fullUsername,
      password: cleanPassword,
      email: `${cleanUsername}@${tenantSlug || 'zilox'}.com`,
      phone: cleanedPhone,
      role: newRole,
      avatarUrl: getRoleDefaultAvatar(newRole),
      branchId: targetBranch,
      branchName: resolvedBranchName,
      isActive: true,
      notes: newNotes.trim(),
      tenantSlug: currentUser.tenantSlug
    });

    resetForm();
    onUserCreated(created);
    onClose();
  };

  return (
    <DialogPortal>
      <DialogOverlay onClick={handleClose} />
      <DialogContent
        className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-6 text-foreground"
        style={{ maxWidth: '520px' }}
      >
        {/* Modern Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground m-0 leading-tight">
              {isAr ? 'إنشاء حساب موظف جديد' : 'Create New Staff Account'}
            </h3>
            <p className="text-xs text-muted-foreground m-0 mt-1 leading-normal">
              {isAr
                ? 'سيتمكن الموظف من تسجيل الدخول فوراً بهذا الاسم وكلمة المرور'
                : 'Staff member can log in instantly with these credentials'}
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {formError && (
          <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body with anti-autofill dummy inputs */}
        <form onSubmit={handleCreateUser} className="space-y-4" autoComplete="off" data-form-type="other">
          {/* Invisible decoy inputs to absorb browser password manager heuristics */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} autoComplete="current-password" />

          {/* Full Name */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground/80 block">
              {isAr ? 'اسم الموظف الكامل الثلاثي *' : 'Full Na\u200Cme *'}
            </span>
            <Input
              required
              autoComplete="new-password"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder={isAr ? 'مثال: أحمد محمد علي' : 'e.g. John Doe'}
              className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>

          {/* Grid: Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="staff-alias-field">
                {isAr ? 'اسم المستخدم *' : 'Username *'}
              </Label>
              <Input
                id="staff-alias-field"
                name="zilox_staff_uname"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                readOnly={isUsernameReadOnly}
                onFocus={() => setIsUsernameReadOnly(false)}
                required
                value={newUsername}
                onChange={(e) =>
                  setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                }
                placeholder={isAr ? 'مثال: ahmed_pos' : 'e.g. ahmed_pos'}
                className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-security-field">
                {isAr ? 'كلمة المرور الأولية *' : 'Initial Password *'}
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="staff-security-field"
                  name="staff_security_field"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isAr ? 'أدخل كلمة المرور...' : 'Enter initial password...'}
                  className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs pl-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Grid: Role & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="role">
                {isAr ? 'الرتبة والدور الوظيفي *' : 'Job Role & Permissions *'}
              </Label>
              <Select
                value={newRole}
                onValueChange={(val) => setNewRole(val as UserRole)}
              >
                <SelectTrigger
                  id="role"
                  className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                >
                  <SelectValue placeholder={isAr ? 'اختر الرتبة' : 'Select Role'} />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                  <SelectItem value="Cashier">
                    {isAr ? 'الكاشير وموظف البيع' : 'Cashier'}
                  </SelectItem>
                  <SelectItem value="Storekeeper">
                    {isAr ? 'أمين المخزن والمستودع' : 'Storekeeper'}
                  </SelectItem>
                  {currentUser.role === 'SuperAdmin' && (
                    <>
                      <SelectItem value="Accountant">
                        {isAr ? 'المحاسب المالي' : 'Accountant'}
                      </SelectItem>
                      <SelectItem value="BranchManager">
                        {isAr ? 'مدير الفرع / المشرف' : 'Branch Manager'}
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch">
                {isAr ? 'الفرع / المستودع *' : 'Assigned Branch *'}
              </Label>
              <Select
                value={
                  currentUser.role === 'BranchManager'
                    ? currentUser.branchId
                    : newBranchId
                }
                onValueChange={setNewBranchId}
                disabled={currentUser.role === 'BranchManager'}
              >
                <SelectTrigger
                  id="branch"
                  className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                >
                  <SelectValue placeholder={isAr ? 'اختر الفرع' : 'Select Branch'} />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border shadow-xl">
                  {currentUser.role === 'SuperAdmin' ? (
                    <>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {isAr ? wh.nameAr : (wh.nameEn || wh.nameAr)}
                        </SelectItem>
                      ))}
                      <SelectItem value="ALL">
                        {isAr ? 'كافة الفروع والمستودعات' : 'All Branches & Warehouses'}
                      </SelectItem>
                    </>
                  ) : (
                    <SelectItem value={currentUser.branchId}>
                      {currentUser.branchName}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Phone Input with LTR formatting and BiDi protection mark */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground/80 block">
              {isAr ? 'رقم الهاتف' : 'Pho\u200Cne Num\u200Cber'}
            </span>
            <Input
              type="text"
              dir="ltr"
              autoComplete="new-password"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder={isAr ? 'رقم الهاتف مع رمز الدولة...' : '+1 (555) 000-0000'}
              style={{ direction: 'ltr', textAlign: 'left' }}
              className="h-10 border border-border/80 bg-background focus:border-primary focus:ring-1 focus:ring-primary shadow-xs font-mono text-xs text-left placeholder:text-left"
            />
          </div>

          {/* Modern Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40 mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-10 px-4 text-sm font-medium"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {isAr ? 'حفظ وإنشاء الحساب' : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  );
}
