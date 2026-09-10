import AccountOverviewTemplate from "./_components/account-overview.mdx";

export default function AccountLoading() {
	return <AccountOverviewTemplate state={{ status: "loading" }} />;
}
