import SiteFooter
    from "../../components/site/SiteFooter";

import SiteHeader
    from "../../components/site/SiteHeader";

import PublicRealtimeBridge
    from "../../components/realtime/PublicRealtimeBridge";

import {
    DEFAULT_RESTAURANT_SETTINGS,
    getRestaurantSettings,
} from "../../lib/website-api";

export const dynamic =
    "force-dynamic";

export default async function SiteLayout({
    children,
}: Readonly<{
    children:
    React.ReactNode;
}>) {
    const settings =
        await getRestaurantSettings()
            .catch(
                () =>
                    DEFAULT_RESTAURANT_SETTINGS,
            );

    return (
        <div className="site-root">
            <PublicRealtimeBridge />

            <SiteHeader
                settings={
                    settings
                }
            />

            {children}

            <SiteFooter
                settings={
                    settings
                }
            />
        </div>
    );
}