"use client";

import { useState } from "react";
import { useGamificationStoreApi } from "./_hooks";
import { extractError, GAME_LABELS } from "./_utils";
import GameWidgetTemplate from "./game-widget.mdx";

interface GameData {
	id: string;
	name: string;
	description?: string | undefined;
	type: string;
	isActive: boolean;
	requireEmail: boolean;
	requireNewsletterOptIn: boolean;
	settings: Record<string, unknown>;
	startDate?: string | undefined;
	endDate?: string | undefined;
}

interface PlayResult {
	id: string;
	result: "win" | "lose";
	prizeName?: string | undefined;
	prizeValue?: string | undefined;
	isRedeemed: boolean;
}

interface CanPlayResult {
	canPlay: boolean;
	reason?: string | undefined;
	nextPlayAt?: string | undefined;
}

export function GameWidget(props: {
	gameId?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const gameId = props.gameId ?? props.params?.gameId ?? "";
	const api = useGamificationStoreApi();

	const [email, setEmail] = useState("");
	const [optIn, setOptIn] = useState(false);
	const [emailSubmitted, setEmailSubmitted] = useState(false);
	const [playResult, setPlayResult] = useState<PlayResult | null>(null);
	const [redeemError, setRedeemError] = useState("");
	const [playError, setPlayError] = useState("");
	const [isSpinning, setIsSpinning] = useState(false);

	const { data: gameData, isLoading: gameLoading } = api.getGame.useQuery({
		params: { id: gameId },
	}) as {
		data: { game: GameData | null } | undefined;
		isLoading: boolean;
	};

	const { data: canPlayData, refetch: refetchCanPlay } = api.canPlay.useQuery({
		params: { id: gameId },
		...(email ? { email } : {}),
	}) as {
		data: CanPlayResult | undefined;
		refetch: () => void;
	};

	const playMutation = api.play.useMutation({
		onMutate: () => {
			setIsSpinning(true);
			setPlayError("");
		},
		onSuccess: (data) => {
			const result = (data as { play: PlayResult | null }).play;
			setIsSpinning(false);
			if (result) {
				setPlayResult(result);
				void refetchCanPlay();
			} else {
				setPlayError(
					(data as { error?: string }).error ?? "Something went wrong.",
				);
			}
		},
		onError: (err: Error) => {
			setIsSpinning(false);
			setPlayError(extractError(err, "Unable to play. Please try again."));
		},
	});

	const redeemMutation = api.redeemPrize.useMutation({
		onSuccess: (data) => {
			const updated = (data as { play: PlayResult | null }).play;
			if (updated) setPlayResult(updated);
		},
		onError: (err: Error) => {
			setRedeemError(extractError(err, "Failed to redeem prize."));
		},
	});

	const game = gameData?.game;
	const labels = GAME_LABELS[game?.type ?? "wheel"] ?? GAME_LABELS.wheel;

	const needsEmail = game?.requireEmail && !emailSubmitted && !playResult;
	const canPlay = canPlayData?.canPlay ?? false;

	const handleEmailSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!email.trim()) return;
		setEmailSubmitted(true);
	};

	const handlePlay = () => {
		if (!canPlay || isSpinning) return;
		playMutation.mutate({
			params: { id: gameId },
			body: emailSubmitted ? { email } : {},
		});
	};

	const handleRedeem = () => {
		if (!playResult?.id) return;
		redeemMutation.mutate({ params: { id: playResult.id } });
	};

	const handleReset = () => {
		setPlayResult(null);
		setPlayError("");
		setRedeemError("");
	};

	return (
		<GameWidgetTemplate
			isLoading={gameLoading}
			game={game}
			labels={labels}
			needsEmail={needsEmail}
			emailSubmitted={emailSubmitted}
			email={email}
			onEmailChange={setEmail}
			optIn={optIn}
			onOptInChange={setOptIn}
			onEmailSubmit={handleEmailSubmit}
			requireNewsletterOptIn={game?.requireNewsletterOptIn ?? false}
			canPlay={canPlay}
			canPlayReason={canPlayData?.reason}
			nextPlayAt={canPlayData?.nextPlayAt}
			isSpinning={isSpinning}
			onPlay={handlePlay}
			playError={playError}
			playResult={playResult}
			isRedeeming={redeemMutation.isPending}
			isRedeemed={playResult?.isRedeemed ?? false}
			redeemError={redeemError}
			onRedeem={handleRedeem}
			onReset={handleReset}
		/>
	);
}
