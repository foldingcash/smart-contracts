// Pure re-implementation of the release math in TokenVault/releaseToken.js
// (which itself mirrors TokenVault_Release.cash's `release` function), so
// the UI can preview the effect of a chosen block height before building a
// real transaction. Keep this in lockstep with the contract if it changes.

/**
 * @param {object} args
 * @param {bigint} args.blockHeight height to release up to
 * @param {bigint} args.previousReleaseHeight
 * @param {bigint} args.previousHalvingHeight
 * @param {bigint} args.previousReward
 * @param {bigint} args.halvingLength
 * @param {bigint} args.lockedTokenAmount amount currently held by the contract
 */
export function calculateRelease({
    blockHeight,
    previousReleaseHeight,
    previousHalvingHeight,
    previousReward,
    halvingLength,
    lockedTokenAmount,
}) {
    if (blockHeight < 0n) {
        throw new Error('Block height must not be negative.');
    }
    if (blockHeight < previousReleaseHeight) {
        throw new Error('Block height must not be less than the last release height.');
    }

    let nextReleaseHeight = blockHeight;
    let nextHalvingHeight = previousHalvingHeight;
    let nextReward = previousReward;

    let minedBlocksSinceLastRelease = blockHeight - previousReleaseHeight + 1n;
    let releaseTokenAmount = minedBlocksSinceLastRelease * previousReward;

    const minedBlocksSinceHalving = blockHeight - previousHalvingHeight + 1n;
    let halvingTriggered = false;

    if (minedBlocksSinceHalving >= halvingLength) {
        halvingTriggered = true;
        nextReleaseHeight = previousHalvingHeight + halvingLength;
        nextHalvingHeight = nextReleaseHeight;
        nextReward = previousReward / 2n;
        if (nextReward < 1n) {
            nextReward = 1n;
        }

        minedBlocksSinceLastRelease = nextReleaseHeight - previousReleaseHeight;
        releaseTokenAmount = minedBlocksSinceLastRelease * previousReward;
    }

    const rawChange = lockedTokenAmount - releaseTokenAmount;
    const endOfLife = rawChange <= 0n;
    if (endOfLife) {
        releaseTokenAmount = lockedTokenAmount;
    }

    return {
        nextReleaseHeight,
        nextHalvingHeight,
        nextReward,
        releaseTokenAmount,
        changeTokenAmount: endOfLife ? 0n : rawChange,
        halvingTriggered,
        endOfLife,
    };
}

/** The earliest block height at which releasing would trigger a halving event. */
export function halvingEligibleHeight(previousHalvingHeight, halvingLength) {
    return previousHalvingHeight + halvingLength - 1n;
}
