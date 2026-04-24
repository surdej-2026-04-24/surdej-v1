import { useAuth } from '@/core/auth/AuthContext';
import { MfaSetup } from '@/routes/profile/MfaSetup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';

/**
 * Gate component that blocks navigation for admin users
 * who haven't set up MFA yet.
 */
export function MfaOnboardingGate({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();

    if (!user?.mfaSetupRequired) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <ShieldAlert className="h-7 w-7 text-amber-600" />
                    </div>
                    <CardTitle className="text-xl">Two-Factor Authentication Required</CardTitle>
                    <CardDescription className="mt-2">
                        As an administrator, you are required to set up two-factor authentication
                        before accessing the application. This helps protect your account and
                        the organization's data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <MfaSetup onComplete={() => {
                        // Refresh user data from /me to update mfaSetupRequired
                        window.location.reload();
                    }} />
                    <div className="pt-2 border-t flex justify-end">
                        <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-muted-foreground">
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
