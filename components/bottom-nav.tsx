'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, Users, CreditCard, 
  UserCheck, FileText, Target,
  ShieldCheck
} from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : ''

  const adminLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/students', icon: Users, label: 'Students' },
    { href: '/attendance', icon: UserCheck, label: 'Attendance' },
    { href: '/fees', icon: CreditCard, label: 'Fees' },
    { href: '/reports', icon: FileText, label: 'Reports' },
  ]

  const superAdminLinks = [
    { href: '/super-admin', icon: ShieldCheck, label: 'Tenants' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/crm', icon: Target, label: 'CRM' },
  ]

  const links = role === 'super_admin' ? superAdminLinks : adminLinks

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/10 md:hidden">
      <div className="flex items-center justify-around py-2">
        {links.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                isActive 
                  ? 'text-teal-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <link.icon className="w-5 h-5" />
              <span className="text-xs">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
