import CustomerOrderingPage
    from '@/components/customer-ordering/CustomerOrderingPage';

interface PageProps {
    params: Promise<{
        token: string;
    }>;
}

export default async function TableOrderingPage(
    {
        params,
    }: PageProps,
) {
    const {
        token,
    } =
        await params;

    return (
        <CustomerOrderingPage
            token={token}
        />
    );
}