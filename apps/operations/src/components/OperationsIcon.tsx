import type {
    NavigationIcon,
} from '../navigation/navigation';

const labels:
    Record<
        NavigationIcon,
        string
    > = {
    dashboard:
        'DB',

    tables:
        'TB',

    orders:
        'OR',

    menu:
        'MN',

    inventory:
        'ST',

    ingredients:
        'IN',

    recipes:
        'RC',

    suppliers:
        'SP',

    purchases:
        'PO',

    payments:
        'PY',

    wastage:
        'WS',

    adjustments:
        'AD',

    expenses:
        'EX',

    'business-day':
        'BD',

    reports:
        'RP',

    users:
        'US',

    settings:
        'SE',

    website:
        'WB',

    audit:
        'AU',
};

export default function OperationsIcon(
    {
        name,
    }: {
        name:
        NavigationIcon;
    },
) {
    return (
        <span
            className="ops-nav-icon"
            aria-hidden="true"
        >
            {
                labels[
                name
                ]
            }
        </span>
    );
}