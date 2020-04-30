// @flow
import * as React from 'react';
import { withStyles } from '@material-ui/core/styles';
import NewRun from '../NewRun';
import TextEditorItem from './TextEditorItem';
import { getAfterSortKey } from '../../../util/worksheet_utils';

function getIds(item) {
    if (item.mode === 'markup_block') {
        return item.ids;
    } else if (item.mode === 'table_block') {
        if (item.bundles_spec && item.bundles_spec.bundle_infos) {
            return item.bundles_spec.bundle_infos.map((info) => info.id);
        }
    }
    return [];
}

class ItemWrapper extends React.Component {
    state = {
        showNewRun: false,
        showNewText: false,
    };

    render() {
        const {
            children,
            classes,
            prevItem,
            item,
            afterItem,
            worksheetUUID,
            reloadWorksheet,
        } = this.props;
        const { showNewRun, showNewText } = this.props;

        if (!item) {
            return null;
        }

        const ids = getIds(item);
        const after_sort_key = getAfterSortKey(item, this.props.subFocusIndex);

        const { isDummyItem } = item;
        return (
            <div className={isDummyItem ? '' : classes.container}>
                {!isDummyItem && <div className={classes.main}>{children}</div>}
                {showNewRun && (
                    <div className={classes.insertBox}>
                        <NewRun
                            after_sort_key={after_sort_key}
                            ws={this.props.ws}
                            onSubmit={() => this.props.onHideNewRun()}
                            reloadWorksheet={reloadWorksheet}
                        />
                    </div>
                )}
                {showNewText && (
                    <TextEditorItem
                        ids={ids}
                        mode='create'
                        after_sort_key={after_sort_key}
                        worksheetUUID={worksheetUUID}
                        reloadWorksheet={reloadWorksheet}
                        closeEditor={() => {
                            this.props.onHideNewText();
                        }}
                    />
                )}
            </div>
        );
    }
}

const styles = (theme) => ({
    container: {
        position: 'relative',
        marginBottom: 20,
        zIndex: 5,
    },
    main: {
        zIndex: 10,
        border: `2px solid transparent`,
        '&:hover': {
            backgroundColor: theme.color.grey.lightest,
            border: `2px solid ${theme.color.grey.base}`,
        },
    },
    insertBox: {
        border: `2px solid ${theme.color.primary.base}`,
        margin: '32px 64px !important',
    },
});

export default withStyles(styles)(ItemWrapper);
